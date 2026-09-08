sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/Menu",
    "sap/m/MenuItem",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/format/DateFormat",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    Menu,
    MenuItem,
    Spreadsheet,
    DateFormat,
    FlattenedDataset,
    DimensionDefinition,
    MeasureDefinition,
    FeedItem
) {

    "use strict";

    var oIsoDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
    var oDisplayDateFormat = DateFormat.getDateInstance({ pattern: "dd.MM.yyyy" });


    var RECON_CHART_TYPE_CONFIG = {

        bar: { vizType: "bar", label: "Bar Chart", icon: "sap-icon://horizontal-bar-chart-2" },
        column: { vizType: "column", label: "Column Chart", icon: "sap-icon://vertical-bar-chart" },
        line: { vizType: "line", label: "Line Chart", icon: "sap-icon://line-chart" },
        pie: { vizType: "pie", label: "Pie Chart", icon: "sap-icon://pie-chart" },
        donut: { vizType: "donut", label: "Donut Chart", icon: "sap-icon://donut-chart" },
        heatmap: { vizType: "heatmap", label: "Heat Map", icon: "sap-icon://heatmap-chart" },
        stacked_bar: { vizType: "stacked_bar", label: "Stacked Bar Chart", icon: "sap-icon://horizontal-bar-chart" },
        stacked_column: { vizType: "stacked_column", label: "Stacked Column Chart", icon: "sap-icon://vertical-bar-chart-2" },
        "100_stacked_bar": { vizType: "100_stacked_bar", label: "100% Stacked Bar Chart", icon: "sap-icon://full-stacked-chart" },
        "100_stacked_column": { vizType: "100_stacked_column", label: "100% Stacked Column Chart", icon: "sap-icon://full-stacked-column-chart" }

    };

    // ✅ One fixed color per category, in the order they appear in
    // /chartData: PC received (blue), DM posted (green), Reconciliation
    // gap (red — visually flags it as the "problem" bar). Reused by
    // every axis-style chart type below.
   // ✅ Muted palette — PC received, DM posted, Reconciliation gap
var RECON_CHART_COLORS = ["#7c93b3", "#7a9e7e", "#c17b74"];


    return Controller.extend(
        "payment.dashboard.controller.Reconciliation",
        {

            onInit: function () {

                var oData = {

                    kpi: {
                        totalAmount: "0.00",
                        totalObjects: "0",
                        debitTotal: "0.00",
                        creditTotal: "0.00"
                    },

                    chartData: [
                        { Category: "PC received", Amount: 0 },
                        { Category: "DM posted", Amount: 0 },
                        { Category: "Reconciliation gap", Amount: 0 }
                    ],

                    filters: {
                        system1: "PC",   // ✅ default
                        system2: "DM"    // ✅ default
                    },

                    groups: [],

                    // ✅ Which chart category (if any) the table is
                    // currently filtered to, and the message shown above
                    // the table explaining that filter.
                    selectedCategory: "",
                    filterMessage: "",

                    busy: false

                };

                var oModel = new JSONModel(oData);
                oModel.setSizeLimit(1000);
                this.getView().setModel(oModel, "reconciliation");

                this._sActiveReconChartType = "column";

                // ✅ Full set of raw OData rows from the last successful
                // load, kept so a bar click can re-filter the table
                // client-side without a second OData round-trip.
                this._aReconciliationRawData = [];

                this.getView().addEventDelegate({

                    onAfterRendering: function () {

                        setTimeout(

                            function () {

                                this._createReconChart();

                            }.bind(this),

                            300

                        );

                    }.bind(this)

                });

                this.loadReconciliationData();

            },


            loadReconciliationData: function () {

                var oODataModel = this.getOwnerComponent().getModel("odataModel");
                var oFilterModel = this.getView().getModel("filterModel");

                var sClearingArea = oFilterModel
                    ? oFilterModel.getProperty("/clearingArea")
                    : "DEBNKC";

                var sSelectedDate = oFilterModel
                    ? oFilterModel.getProperty("/kpiDate")
                    : new Date().toISOString().slice(0, 10);

                var oReconModel = this.getView().getModel("reconciliation");

                if (!oODataModel) {
                    console.error("[Reconciliation] 'odataModel' not found on the component.");
                    return;
                }

                if (!oReconModel) {
                    console.error("[Reconciliation] 'reconciliation' model not found on the view.");
                    return;
                }

                var sDate;

                if (sSelectedDate instanceof Date) {

                    sDate =
                        sSelectedDate.getFullYear() + "-" +
                        String(sSelectedDate.getMonth() + 1).padStart(2, "0") + "-" +
                        String(sSelectedDate.getDate()).padStart(2, "0");

                } else {

                    sDate = String(sSelectedDate).slice(0, 10);

                }

                if (!sClearingArea || !sDate) {
                    console.warn("[Reconciliation] Missing clearing area or date — skipping load.");
                    return;
                }

                console.log("[Reconciliation] Loading for", sClearingArea, sDate);

                oReconModel.setProperty("/busy", true);

                var aFilters = [
                    new Filter("clearing_area", FilterOperator.EQ, sClearingArea),
                    new Filter("pi_post_date", FilterOperator.EQ, sDate)
                ];

                var oListBinding = oODataModel.bindList(
                    "/Reconcilation",
                    undefined,
                    undefined,
                    aFilters,
                    {
                        $select: [
                            "clearing_area",
                            "pi_post_date",
                            "reconc_date",
                            "reconc_system",
                            "AM_AREA",
                            "reconc_appl",
                            "reconc_id",
                            "reconc_group",
                            "pi_kind",
                            "tr_curr",
                            "tr_debcredind",
                            "object_count",
                            "amount_sum"
                        ].join(",")
                    }
                );

                oListBinding.requestContexts(0, 5000)

                    .then(function (aContexts) {

                        console.log("[Reconciliation] Rows received:", aContexts.length);

                        var aRawData = aContexts.map(function (oContext) {
                            return oContext.getObject();
                        });

                        console.log("[Reconciliation] Raw data sample:", aRawData.slice(0, 3));

                        this._processReconciliationData(aRawData);

                    }.bind(this))

                    .catch(function (oError) {

                        MessageToast.show("Error loading reconciliation data.");
                        console.error("[Reconciliation] OData load failed:", oError);

                        this._processReconciliationData([]);

                    }.bind(this))

                    .finally(function () {

                        oReconModel.setProperty("/busy", false);

                    });

            },


            reload: function () {

                this.loadReconciliationData();

            },


            /* ============================================================
               FULL RENDER — runs on every fresh OData load. Always shows
               ALL data first, per the requirement, and clears any bar
               filter that was active from a previous load.
               ============================================================ */

            _processReconciliationData: function (aRawData) {

                var oReconModel = this.getView().getModel("reconciliation");

                this._aReconciliationRawData = aRawData || [];

                oReconModel.setProperty("/selectedCategory", "");
                oReconModel.setProperty("/filterMessage", "");

                this._applySystemGate();   // ✅ was: manual group/kpi/chart building here

            },


            /* ============================================================
               SHARED BUILDER — turns a set of raw OData rows into the
               groups[]/kpi shape the table needs, plus the two chart
               bucket totals. Used both for the full dataset (above) and
               for a bar-click filtered subset (below), so both paths
               always group/aggregate identically.
               ============================================================ */

            _buildGroupsAndKpi: function (aRawData) {

                var oGroupsMap = {};
                var aGroupOrder = [];

                var fTotalAmount = 0;
                var iTotalObjects = 0;
                var fDebitTotal = 0;
                var fCreditTotal = 0;

                var fPcReceived = 0;
                var fDmPosted = 0;

                aRawData.forEach(function (oRow) {

                    var fAmount = Number(oRow.amount_sum) || 0;
                    var iObjectCount = Number(oRow.object_count) || 0;

                    var sDirection = oRow.tr_debcredind === "D" ? "Debit" : "Credit";
                    var sDirectionState = sDirection === "Credit" ? "Success" : "Error";
                    var sDateKey = oRow.pi_post_date || oRow.reconc_date;
                    var sGroupKey = sDateKey + "_" + oRow.tr_curr + "_" + sDirection;

                    if (!oGroupsMap[sGroupKey]) {

                        oGroupsMap[sGroupKey] = {
                            groupId: sGroupKey,
                            date: this._formatDate(sDateKey),
                            currency: oRow.tr_curr,
                            direction: sDirection,
                            directionState: sDirectionState,
                            count: 0,
                            amount: 0,
                            expanded: false,
                            details: []
                        };

                        aGroupOrder.push(sGroupKey);

                    }

                    var oGroup = oGroupsMap[sGroupKey];

                    oGroup.count += iObjectCount;
                    oGroup.amount += fAmount;

                    oGroup.details.push({
                        AccountManagement: oRow.AM_AREA,
                        SystemId: oRow.reconc_system,
                        ApplicationId: oRow.reconc_appl,
                        AddId: oRow.reconc_id,
                        ReconciliationGroupKey: oRow.reconc_group,
                        PaymentItemCategory: oRow.pi_kind,
                        ReconciliationObjects: iObjectCount,
                        ReconciliationAmount: fAmount
                    });

                    fTotalAmount += fAmount;
                    iTotalObjects += iObjectCount;

                    if (oRow.tr_debcredind === "D") {
                        fDebitTotal += fAmount;
                    } else {
                        fCreditTotal += fAmount;
                    }

                    if (oRow.reconc_group === "IN") {
                        fPcReceived += fAmount;
                    } else if (oRow.reconc_group === "BAS") {
                        fDmPosted += fAmount;
                    }

                }.bind(this));


                if (aGroupOrder.length) {
                    oGroupsMap[aGroupOrder[0]].expanded = true;
                }

                var aGroups = aGroupOrder.map(function (sKey) {
                    return oGroupsMap[sKey];
                });

                return {
                    groups: aGroups,
                    kpi: {
                        totalAmount: fTotalAmount.toFixed(2),
                        totalObjects: String(iTotalObjects),
                        debitTotal: fDebitTotal.toFixed(2),
                        creditTotal: fCreditTotal.toFixed(2)
                    },
                    fPcReceived: fPcReceived,
                    fDmPosted: fDmPosted
                };

            },


            _formatDate: function (sIsoDate) {

                if (!sIsoDate) { return ""; }

                var oDate = oIsoDateFormat.parse(sIsoDate);
                return oDate ? oDisplayDateFormat.format(oDate) : sIsoDate;

            },


            /* ============================================================
               CREATE RECONCILIATION CHART
               ============================================================ */

            _createReconChart: function () {

                var oChart = this.byId("reconciliationBarVizFrame");

                if (!oChart) {
                    console.error("Reconciliation VizFrame not found.");
                    return;
                }

                var oModel = this.getView().getModel("reconciliation");
                if (!oModel) { return; }

                var aChartData = oModel.getProperty("/chartData");

                console.log("RECONCILIATION CHART DATA:", aChartData);

                if (!Array.isArray(aChartData) || !aChartData.length) {
                    console.error("Reconciliation chart data is empty.");
                    return;
                }

                var oOldDataset = oChart.getDataset();

                if (oOldDataset) {
                    oChart.setDataset(null);
                    oOldDataset.destroy();
                }

                oChart.removeAllFeeds();

                var oDataset = new FlattenedDataset({

                    data: { path: "/chartData" },

                    dimensions: [
                        new DimensionDefinition({
                            name: "Category",
                            value: "{Category}"
                        })
                    ],

                    measures: [
                        new MeasureDefinition({
                            name: "Amount",
                            value: "{Amount}"
                        })
                    ]

                });

                oChart.setModel(oModel);
                oChart.setDataset(oDataset);
                oChart.setVizType("column");

                this._configureReconChart("column");

                console.log("Reconciliation chart created successfully.");

            },


            onReconChartTypeMenuPress: function (oEvent) {

                var oButton = oEvent.getSource();

                if (!this._oReconChartTypeMenu) {

                    var aItems = Object.keys(RECON_CHART_TYPE_CONFIG).map(

                        function (sKey) {

                            var oConfig = RECON_CHART_TYPE_CONFIG[sKey];

                            var oItem = new MenuItem({
                                text: oConfig.label,
                                icon: oConfig.icon
                            });

                            oItem.data("configKey", sKey);

                            return oItem;

                        }

                    );

                    this._oReconChartTypeMenu = new Menu({

                        items: aItems,

                        itemSelected: this.onReconChartTypeSelected.bind(this)

                    });

                    this.getView().addDependent(this._oReconChartTypeMenu);

                }

                this._oReconChartTypeMenu.openBy(oButton);

            },


            onReconChartTypeSelected: function (oEvent) {

                var oItem = oEvent.getParameter("item");
                if (!oItem) { return; }

                var sChartType = oItem.data("configKey");
                if (!sChartType) { return; }

                this._applyReconChartType(sChartType);

            },


            _applyReconChartType: function (sChartType) {

                var oChart = this.byId("reconciliationBarVizFrame");
                if (!oChart) { return; }

                var oConfig = RECON_CHART_TYPE_CONFIG[sChartType];
                if (!oConfig) { return; }

                this._sActiveReconChartType = sChartType;

                var oButton = this.byId("reconChartTypeButton");

                if (oButton) {
                    oButton.setIcon(oConfig.icon);
                    oButton.setTooltip(oConfig.label);
                }

                oChart.setVizType(oConfig.vizType);

                this._configureReconChart(sChartType);

            },


            _configureReconChart: function (sChartType) {

                switch (sChartType) {

                    case "pie":
                        this._configureReconPieChart();
                        break;

                    case "donut":
                        this._configureReconDonutChart();
                        break;

                    case "heatmap":
                        this._configureReconHeatmapChart();
                        break;

                    default:
                        this._configureReconAxisChart();
                        break;

                }

            },


            /* ✅ FIX #1 — added a "color" feed bound to the same Category
               dimension used for categoryAxis, plus an explicit
               colorPalette. Without a color feed, sap.viz treats a
               single-measure axis chart as one series, so every bar got
               the same default blue regardless of category. */
            _configureReconAxisChart: function () {

                var oChart = this.byId("reconciliationBarVizFrame");
                if (!oChart) { return; }

                oChart.removeAllFeeds();

                oChart.addFeed(new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: ["Category"]
                }));

                oChart.addFeed(new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: ["Amount"]
                }));

                // ✅ NEW — this is what actually makes each bar its own color
                oChart.addFeed(new FeedItem({
                    uid: "color",
                    type: "Dimension",
                    values: ["Category"]
                }));

                oChart.setVizProperties({

                    title: { visible: false },

                    // Legend is more useful now that bars aren't all the
                    // same color — flip on if you want a color key.
                    legend: { visible: false },

                    plotArea: {
                        dataLabel: { visible: true, formatString: "#,##0.00" },
                        drawingEffect: "glossy",
                        colorPalette: RECON_CHART_COLORS
                    },

                    categoryAxis: {
                        title: { visible: false },
                        label: { visible: true }
                    },

                    valueAxis: {
                        title: { visible: true, text: "Amount (EUR)" },
                        label: { formatString: "#,##0" }
                    }

                });

                oChart.invalidate();
                oChart.rerender();

            },


            _configureReconPieChart: function () {

                var oChart = this.byId("reconciliationBarVizFrame");
                if (!oChart) { return; }

                oChart.removeAllFeeds();

                oChart.addFeed(new FeedItem({
                    uid: "color", type: "Dimension", values: ["Category"]
                }));

                oChart.addFeed(new FeedItem({
                    uid: "size", type: "Measure", values: ["Amount"]
                }));

                oChart.setVizProperties({
                    title: { visible: false },
                    legend: { visible: true, position: "right" },
                    plotArea: {
                        dataLabel: { visible: true, formatString: "#,##0.00" },
                        colorPalette: RECON_CHART_COLORS
                    }
                });

                oChart.invalidate();
                oChart.rerender();

            },


            _configureReconDonutChart: function () {

                var oChart = this.byId("reconciliationBarVizFrame");
                if (!oChart) { return; }

                oChart.removeAllFeeds();

                oChart.addFeed(new FeedItem({
                    uid: "color", type: "Dimension", values: ["Category"]
                }));

                oChart.addFeed(new FeedItem({
                    uid: "size", type: "Measure", values: ["Amount"]
                }));

                oChart.setVizProperties({
                    title: { visible: false },
                    legend: { visible: true, position: "right" },
                    plotArea: {
                        dataLabel: { visible: true },
                        colorPalette: RECON_CHART_COLORS
                    }
                });

                oChart.invalidate();
                oChart.rerender();

            },


            _configureReconHeatmapChart: function () {

                var oChart = this.byId("reconciliationBarVizFrame");
                if (!oChart) { return; }

                oChart.removeAllFeeds();

                oChart.addFeed(new FeedItem({
                    uid: "categoryAxis", type: "Dimension", values: ["Category"]
                }));

                oChart.addFeed(new FeedItem({
                    uid: "color", type: "Measure", values: ["Amount"]
                }));

                oChart.setVizProperties({
                    title: { visible: false },
                    legend: { visible: true }
                });

                oChart.invalidate();
                oChart.rerender();

            },


            /* ============================================================
               ✅ FIX #2 — CLICK-TO-FILTER

               Clicking a bar filters the table below to just that
               category's rows. "PC received"/"DM posted" map cleanly to
               reconc_group = "IN" / "BAS". "Reconciliation gap" has no
               such mapping (see _applyChartCategoryFilter) — it's a
               derived difference, not a set of rows.
               ============================================================ */

            onReconciliationChartSelect: function (oEvent) {

                if (!this._isValidSystemCombo()) { return; }   // ✅

                var aData = oEvent.getParameter("data");
                if (!aData || !aData.length) { return; }

                var oSelected = aData[0].data;
                var sCategory = oSelected.Category;

                this._applyChartCategoryFilter(sCategory);

            },


            _applyChartCategoryFilter: function (sCategory) {

                var oReconModel = this.getView().getModel("reconciliation");
                var aRawData = this._aReconciliationRawData || [];

                var aFilteredRows;
                var sMessage;

                switch (sCategory) {

                    case "PC received":

                        aFilteredRows = aRawData.filter(function (oRow) {
                            return oRow.reconc_group === "IN";
                        });

                        sMessage = "Showing " + aFilteredRows.length + " item(s) for PC received (reconc_group = IN).";

                        break;

                    case "DM posted":

                        aFilteredRows = aRawData.filter(function (oRow) {
                            return oRow.reconc_group === "BAS";
                        });

                        sMessage = "Showing " + aFilteredRows.length + " item(s) for DM posted (reconc_group = BAS).";

                        break;

                    case "Reconciliation gap":

                        // ⚠️ The gap is |PC received − DM posted| — a
                        // computed difference, not a real subset of rows.
                        // There's no line item that "is" the gap, so we
                        // can't filter to it the way we can the other two
                        // bars. Falling back to the full dataset with an
                        // explanation rather than showing something
                        // misleading.
                        aFilteredRows = aRawData;

                        sMessage =
                            "\"Reconciliation gap\" is a calculated difference " +
                            "(|PC received − DM posted|), not a specific set of " +
                            "items — showing all items below instead.";

                        break;

                    default:

                        aFilteredRows = aRawData;
                        sMessage = "";

                }

                var oResult = this._buildGroupsAndKpi(aFilteredRows);

                oReconModel.setProperty("/groups", oResult.groups);
                oReconModel.setProperty("/selectedCategory", sCategory);
                oReconModel.setProperty("/filterMessage", sMessage);

            },


            /* "Show All" button — clears the bar filter and restores the
               full table for the currently loaded Clearing Area / Date. */
            onClearChartFilter: function () {

                var oReconModel = this.getView().getModel("reconciliation");
                var oResult = this._buildGroupsAndKpi(this._aReconciliationRawData || []);

                oReconModel.setProperty("/groups", oResult.groups);
                oReconModel.setProperty("/selectedCategory", "");
                oReconModel.setProperty("/filterMessage", "");

            },


            /* ============================================================
               SYSTEM 1 / SYSTEM 2 FILTER LOGIC (unchanged)
               ============================================================ */

            onSystem1Change: function (oEvent) {

                var oModel = this.getView().getModel("reconciliation");
                if (!oModel) { return; }

                var sSystem1 = oEvent.getSource().getSelectedKey();
                var sSystem2 = oModel.getProperty("/filters/system2");

                if (sSystem1 && sSystem1 === sSystem2) {
                    MessageToast.show("System 1 and System 2 cannot be the same.");
                    oEvent.getSource().setSelectedKey("");
                    oModel.setProperty("/filters/system1", "");
                    this._updateSystem2Availability();
                    this._applySystemGate();          // ✅
                    return;
                }

                oModel.setProperty("/filters/system1", sSystem1);
                this._updateSystem2Availability();
                this._applySystemGate();              // ✅

            },

            onSystem2Change: function (oEvent) {

                var oModel = this.getView().getModel("reconciliation");
                if (!oModel) { return; }

                var sSystem2 = oEvent.getSource().getSelectedKey();
                var sSystem1 = oModel.getProperty("/filters/system1");

                if (sSystem2 && sSystem2 === sSystem1) {
                    MessageToast.show("System 1 and System 2 cannot be the same.");
                    oEvent.getSource().setSelectedKey("");
                    oModel.setProperty("/filters/system2", "");
                    this._applySystemGate();          // ✅
                    return;
                }

                oModel.setProperty("/filters/system2", sSystem2);
                this._applySystemGate();              // ✅

            },

            _updateSystem2Availability: function () {

                var oSystem1 = this.byId("system1Select");
                var oSystem2 = this.byId("system2Select");
                var oDMItem = this.byId("system2DMItem");

                if (!oSystem1 || !oSystem2 || !oDMItem) { return; }

                var sSystem1 = oSystem1.getSelectedKey();

                if (sSystem1 === "DM") {

                    oDMItem.setEnabled(false);
                    oSystem2.setSelectedKey("");

                    var oModel = this.getView().getModel("reconciliation");
                    if (oModel) { oModel.setProperty("/filters/system2", ""); }

                } else {
                    oDMItem.setEnabled(true);
                }

            },

            onResetSystemFilters: function () {

                var oModel = this.getView().getModel("reconciliation");
                if (!oModel) { return; }

                oModel.setProperty("/filters/system1", "PC");   // ✅ default, not ""
                oModel.setProperty("/filters/system2", "DM");   // ✅ default, not ""

                var oSystem1 = this.byId("system1Select");
                var oSystem2 = this.byId("system2Select");

                if (oSystem1) { oSystem1.setSelectedKey("PC"); }
                if (oSystem2) { oSystem2.setSelectedKey("DM"); }

                this._updateSystem2Availability();
                this._applySystemGate();               // ✅

            },

            onToggleGroup: function (oEvent) {

                var oContext = oEvent.getSource().getBindingContext("reconciliation");
                if (!oContext) { return; }

                var bExpanded = oContext.getProperty("expanded");

                oContext.getModel().setProperty(
                    oContext.getPath() + "/expanded",
                    !bExpanded
                );

            },


            /* ============================================================
               EXPORT EXCEL (unchanged)
               ============================================================ */

            onExportExcel: function () {

                var oModel = this.getView().getModel("reconciliation");

                if (!oModel) {
                    MessageToast.show("Reconciliation data is not available.");
                    return;
                }

                var aGroups = oModel.getProperty("/groups") || [];
                var aRows = [];

                aGroups.forEach(function (oGroup) {

                    if (!oGroup.details || !oGroup.details.length) { return; }

                    oGroup.details.forEach(function (oDetail) {

                        aRows.push({
                            Date: oGroup.date,
                            Currency: oGroup.currency,
                            Direction: oGroup.direction,
                            AccountManagement: oDetail.AccountManagement,
                            SystemId: oDetail.SystemId,
                            ApplicationId: oDetail.ApplicationId,
                            AddId: oDetail.AddId,
                            ReconciliationGroupKey: oDetail.ReconciliationGroupKey,
                            PaymentItemCategory: oDetail.PaymentItemCategory,
                            ReconciliationObjects: oDetail.ReconciliationObjects,
                            ReconciliationAmount: oDetail.ReconciliationAmount
                        });

                    });

                });

                if (!aRows.length) {
                    MessageToast.show("No reconciliation data to export.");
                    return;
                }

                var aColumns = [
                    { label: "Date", property: "Date" },
                    { label: "Currency", property: "Currency" },
                    { label: "Direction", property: "Direction" },
                    { label: "Acct Mgmt", property: "AccountManagement" },
                    { label: "System ID", property: "SystemId" },
                    { label: "Appl. ID", property: "ApplicationId" },
                    { label: "Add. ID", property: "AddId" },
                    { label: "Reconc. Grp Key", property: "ReconciliationGroupKey" },
                    { label: "Payment Item Category", property: "PaymentItemCategory" },
                    { label: "No. of Rcn Obj.", property: "ReconciliationObjects" },
                    { label: "Recon. Amount", property: "ReconciliationAmount" }
                ];

                var oSettings = {
                    workbook: { columns: aColumns },
                    dataSource: aRows,
                    fileName: "Reconciliation_Details.xlsx"
                };

                var oSpreadsheet = new Spreadsheet(oSettings);

                oSpreadsheet.build().finally(function () {
                    oSpreadsheet.destroy();
                });

            },


            /* ============================================================
               MAXIMIZE / RESTORE — Reconciliation Details table panel.
               ============================================================ */

            onToggleReconDetailsSize: function () {

                var oCard = this.byId("reconciliationDetailsPanel");
                var oButton = this.byId("reconDetailsExpandButton");
                var oScroll = this.byId("reconciliationDetailsScroll");

                if (!this._oReconDetailsDialog) {

                    this._oReconDetailsDialog = new sap.m.Dialog({
                        contentWidth: "95%",
                        contentHeight: "90%",
                        stretch: false,
                        draggable: true,
                        resizable: true,
                        horizontalScrolling: false,
                        verticalScrolling: false
                    });

                    this.getView().addDependent(this._oReconDetailsDialog);

                    this._oReconDetailsDialog.attachAfterClose(function () {

                        if (this._oReconDetailsOriginalParent) {

                            this._oReconDetailsOriginalParent.insertItem(
                                oCard,
                                this._iReconDetailsOriginalIndex
                            );

                            oCard.setWidth("100%");

                            if (oScroll) {
                                oScroll.setHeight("500px");
                                oScroll.setVertical(true);
                            }

                            oButton.setIcon("sap-icon://full-screen");
                            oButton.setTooltip("Maximize");

                            this._bReconDetailsExpanded = false;

                        }

                    }.bind(this));

                }

                if (!this._bReconDetailsExpanded) {

                    this._oReconDetailsOriginalParent = oCard.getParent();

                    this._iReconDetailsOriginalIndex =
                        this._oReconDetailsOriginalParent.indexOfItem(oCard);

                    this._oReconDetailsOriginalParent.removeItem(oCard);

                    this._oReconDetailsDialog.removeAllContent();

                    oCard.setWidth("100%");

                    if (oScroll) {
                        oScroll.setHeight("70vh");
                        oScroll.setVertical(true);
                    }

                    this._oReconDetailsDialog.addContent(oCard);

                    oButton.setIcon("sap-icon://exit-full-screen");
                    oButton.setTooltip("Restore");

                    this._bReconDetailsExpanded = true;

                    this._oReconDetailsDialog.open();

                } else {

                    if (oScroll) {
                        oScroll.setHeight("500px");
                        oScroll.setVertical(true);
                    }

                    this._oReconDetailsDialog.close();

                }

            },

            _isValidSystemCombo: function () {

                var oModel = this.getView().getModel("reconciliation");
                if (!oModel) { return false; }

                var sSystem1 = oModel.getProperty("/filters/system1");
                var sSystem2 = oModel.getProperty("/filters/system2");

                return sSystem1 === "PC" && sSystem2 === "DM";

            },


            /* ✅ Single choke point — chart + table are only ever populated
               through here. If the combo isn't PC → DM, everything is cleared
               and a blocked message is shown, regardless of how much raw data
               was actually loaded from OData. */
            _applySystemGate: function () {

                var oReconModel = this.getView().getModel("reconciliation");
                if (!oReconModel) { return; }

                if (this._isValidSystemCombo()) {

                    var oResult = this._buildGroupsAndKpi(this._aReconciliationRawData || []);
                    var fGap = Math.abs(oResult.fPcReceived - oResult.fDmPosted);

                    oReconModel.setProperty("/groups", oResult.groups);
                    oReconModel.setProperty("/kpi", oResult.kpi);

                    oReconModel.setProperty("/chartData", [
                        { Category: "PC received", Amount: oResult.fPcReceived },
                        { Category: "DM posted", Amount: oResult.fDmPosted },
                        { Category: "Reconciliation gap", Amount: fGap }
                    ]);

                    oReconModel.setProperty("/systemsBlocked", false);
                    oReconModel.setProperty("/systemsBlockedMessage", "");

                } else {

                    oReconModel.setProperty("/groups", []);

                    oReconModel.setProperty("/kpi", {
                        totalAmount: "0.00",
                        totalObjects: "0",
                        debitTotal: "0.00",
                        creditTotal: "0.00"
                    });

                    oReconModel.setProperty("/chartData", [
                        { Category: "PC received", Amount: 0 },
                        { Category: "DM posted", Amount: 0 },
                        { Category: "Reconciliation gap", Amount: 0 }
                    ]);

                    oReconModel.setProperty("/selectedCategory", "");
                    oReconModel.setProperty("/filterMessage", "");

                    oReconModel.setProperty(
                        "/systemsBlocked",
                        true
                    );

                    oReconModel.setProperty(
                        "/systemsBlockedMessage",
                        "Reconciliation is only available for Source System = PC and Target System = DM. Select this combination to view data."
                    );

                }

                this._createReconChart();

            },

        }

    );

});