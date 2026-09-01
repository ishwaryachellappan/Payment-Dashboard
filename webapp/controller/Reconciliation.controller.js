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


    /* ============================================================
       CHART CONFIGURATION (restored from the original controller)
       ============================================================ */

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

                    /*
                     * THIS IS THE RECONCILIATION CHART DATA.
                     * DO NOT CHANGE Category TO Direction.
                     * (restored — still static/hardcoded, exactly as it
                     * was before the OData work started; not derived
                     * from the table's OData rows)
                     */
                    chartData: [
                        { Category: "PC received", Amount: 10000 },
                        { Category: "DM posted", Amount: 9800 },
                        { Category: "Reconciliation gap", Amount: 200 }
                    ],

                    filters: {
                        system1: "",
                        system2: ""
                    },

                    groups: [],

                    busy: false

                };

                var oModel = new JSONModel(oData);
                oModel.setSizeLimit(1000);
                this.getView().setModel(oModel, "reconciliation");


                /* ========================================================
                   DEFAULT CHART TYPE (restored)
                   ======================================================== */

                this._sActiveReconChartType = "column";


                /* ========================================================
                   CREATE CHART AFTER RENDERING (restored)
                   ======================================================== */

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


                /* ====================================================
                   INITIAL TABLE LOAD (unchanged from your working version)
                   ==================================================== */

                this.loadReconciliationData();

            },


            /* ============================================================
               PUBLIC ENTRY POINT (unchanged)
               ============================================================ */

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
                    new Filter("reconc_date", FilterOperator.EQ, sDate)
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
               TRANSFORM RAW ODATA ROWS INTO groups[] FOR THE TABLE
               (unchanged — chartData is intentionally NOT touched here,
               since the chart is static/hardcoded per your request)
               ============================================================ */

            _processReconciliationData: function (aRawData) {

                var oReconModel = this.getView().getModel("reconciliation");

                if (!aRawData || !aRawData.length) {

                    console.warn("[Reconciliation] No rows returned for the given filters.");

                    oReconModel.setProperty("/groups", []);

                    oReconModel.setProperty("/kpi", {
                        totalAmount: "0.00",
                        totalObjects: "0",
                        debitTotal: "0.00",
                        creditTotal: "0.00"
                    });

                    return;

                }

                var oGroupsMap = {};
                var aGroupOrder = [];

                var fTotalAmount = 0;
                var iTotalObjects = 0;
                var fDebitTotal = 0;
                var fCreditTotal = 0;


                aRawData.forEach(function (oRow) {

                    var fAmount = Number(oRow.amount_sum) || 0;
                    var iObjectCount = Number(oRow.object_count) || 0;

                    var sDirection = oRow.tr_debcredind === "D" ? "Debit" : "Credit";
                    var sDirectionState = sDirection === "Credit" ? "Success" : "Error";
                    var sDateKey = oRow.reconc_date || oRow.pi_post_date;
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

                }.bind(this));


                if (aGroupOrder.length) {
                    oGroupsMap[aGroupOrder[0]].expanded = true;
                }

                var aGroups = aGroupOrder.map(function (sKey) {
                    return oGroupsMap[sKey];
                });

                console.log("[Reconciliation] Built groups:", aGroups);

                oReconModel.setProperty("/groups", aGroups);

                oReconModel.setProperty("/kpi", {
                    totalAmount: fTotalAmount.toFixed(2),
                    totalObjects: String(iTotalObjects),
                    debitTotal: fDebitTotal.toFixed(2),
                    creditTotal: fCreditTotal.toFixed(2)
                });

            },


            _formatDate: function (sIsoDate) {

                if (!sIsoDate) { return ""; }

                var oDate = oIsoDateFormat.parse(sIsoDate);
                return oDate ? oDisplayDateFormat.format(oDate) : sIsoDate;

            },


            /* ============================================================
               CREATE RECONCILIATION CHART (restored, unchanged from the
               original controller — reads the static /chartData)
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


            /* ============================================================
               CHART TYPE MENU (restored)
               ============================================================ */

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

                oChart.setVizProperties({

                    title: { visible: false },
                    legend: { visible: false },

                    plotArea: {
                        dataLabel: { visible: true, formatString: "#,##0.00" },
                        drawingEffect: "glossy"
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
                    plotArea: { dataLabel: { visible: true, formatString: "#,##0.00" } }
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
                    plotArea: { dataLabel: { visible: true } }
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


            onReconciliationChartSelect: function (oEvent) {

                var aData = oEvent.getParameter("data");
                if (!aData || !aData.length) { return; }

                console.log("Selected reconciliation data:", aData[0].data);

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
                    return;
                }

                oModel.setProperty("/filters/system1", sSystem1);
                this._updateSystem2Availability();

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
                    return;
                }

                oModel.setProperty("/filters/system2", sSystem2);

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

                oModel.setProperty("/filters/system1", "");
                oModel.setProperty("/filters/system2", "");

                var oSystem1 = this.byId("system1Select");
                var oSystem2 = this.byId("system2Select");

                if (oSystem1) { oSystem1.setSelectedKey(""); }
                if (oSystem2) { oSystem2.setSelectedKey(""); }

                this._updateSystem2Availability();

                MessageToast.show("Reconciliation filters reset");

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

            }

        }

    );

});