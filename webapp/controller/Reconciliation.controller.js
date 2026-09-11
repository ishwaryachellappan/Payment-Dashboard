sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/Menu",
    "sap/m/MenuItem",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/CheckBox",
    "sap/m/SearchField",
    "sap/m/Button",
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
    Dialog,
    List,
    CustomListItem,
    CheckBox,
    SearchField,
    Button,
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

    /* ============================================================
       RECONCILIATION DETAIL COLUMN CONFIGURATION
       ============================================================ */

    var RECON_DETAIL_COLUMNS = [
        {
            key: "ClearingArea",
            label: "Clearing Area",
            type: "text",
            defaultVisible: true
        },
        {
            key: "PiDate",
            label: "PI Date",
            type: "date",
            defaultVisible: true
        },
        {
            key: "PiNo",
            label: "PI No.",
            type: "text",
            defaultVisible: true
        },
        {
            key: "TechStat",
            label: "Technical Status",
            type: "text",
            defaultVisible: false
        },
        {
            key: "PiKind",
            label: "PI Kind",
            type: "text",
            defaultVisible: true
        },
        {
            key: "TrCurr",
            label: "Currency",
            type: "text",
            defaultVisible: true
        },
        {
            key: "TrAmount",
            label: "Transaction Amount",
            type: "amount",
            defaultVisible: true
        },
        {
            key: "Holder",
            label: "Holder",
            type: "text",
            defaultVisible: true
        },
        {
            key: "RefRoute",
            label: "Reference Route",
            type: "text",
            defaultVisible: true
        },
        {
            key: "RefItemExt",
            label: "Reference Item",
            type: "text",
            defaultVisible: false
        },
        {
            key: "RefCustagr",
            label: "Customer Agreement",
            type: "text",
            defaultVisible: false
        },
        {
            key: "Country",
            label: "Country",
            type: "text",
            defaultVisible: false
        },
        {
            key: "Bic",
            label: "BIC",
            type: "text",
            defaultVisible: false
        },
        {
            key: "Iban",
            label: "IBAN",
            type: "text",
            defaultVisible: false
        },
        {
            key: "AcctNo",
            label: "Account No.",
            type: "text",
            defaultVisible: false
        },
        {
            key: "ValDate",
            label: "Value Date",
            type: "date",
            defaultVisible: false
        },
        {
            key: "PiPostDate",
            label: "PI Post Date",
            type: "date",
            defaultVisible: true
        },
        {
            key: "TransType",
            label: "Transaction Type",
            type: "text",
            defaultVisible: false
        },
        {
            key: "RiskScore",
            label: "Risk Score",
            type: "number",
            defaultVisible: false
        },
        {
            key: "EndToEndId",
            label: "End-to-End ID",
            type: "text",
            defaultVisible: false
        },
        {
            key: "SettlementBic",
            label: "Settlement BIC",
            type: "text",
            defaultVisible: false
        }
    ];


    return Controller.extend(
        "payment.dashboard.controller.Reconciliation",
        {

            onInit: function () {

                var aVisibleColumns = RECON_DETAIL_COLUMNS.filter(function (oColumn) {
                    return oColumn.defaultVisible;
                });

                var oData = {
                    kpi: {
                        totalAmount: "0.00",
                        totalObjects: "0",
                        debitTotal: "0.00",
                        creditTotal: "0.00"
                    },

                    chartData: [
                        { Category: "PC Received", Amount: 0 },
                        { Category: "DM Received", Amount: 0 },
                        { Category: "Reconciliation Gap", Amount: 0 }
                    ],

                    filters: {
                        system1: "PC",
                        system2: "DM"
                    },

                    groups: [],

                    selectedCategory: "",
                    filterMessage: "",

                    busy: false,

                    /* NEW */
                    availableColumns: RECON_DETAIL_COLUMNS,

                    visibleColumns: aVisibleColumns
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

                                /*
                                 * Configure dynamic reconciliation columns
                                 */
                                this._refreshReconDetailTables();

                            }.bind(this),
                            300
                        );

                    }.bind(this)
                });

                this.loadReconciliationData();

            },


           loadReconciliationData: async function () {

    var oFilterModel = this.getView().getModel("filterModel");
    var oReconModel = this.getView().getModel("reconciliation");

    if (!oReconModel) {
        console.error("[Reconciliation] 'reconciliation' model not found.");
        return;
    }

    var sClearingArea = oFilterModel
        ? oFilterModel.getProperty("/clearingArea")
        : "DEBNKC";

    var sSelectedDate = oFilterModel
        ? oFilterModel.getProperty("/kpiDate")
        : new Date().toISOString().slice(0, 10);

    // Normalize Date objects to yyyy-MM-dd.
    if (sSelectedDate instanceof Date) {
        sSelectedDate =
            sSelectedDate.getFullYear() + "-" +
            String(sSelectedDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(sSelectedDate.getDate()).padStart(2, "0");
    } else {
        sSelectedDate = String(sSelectedDate).slice(0, 10);
    }

    if (!sClearingArea || !sSelectedDate) {
        console.warn(
            "[Reconciliation] Missing clearing area or date."
        );
        return;
    }

    oReconModel.setProperty("/busy", true);

    try {

        /*
         * Use the manifest service URL directly.
         *
         * This avoids OData V4 list-binding key handling and also
         * prevents sap-client from being accidentally appended inside
         * the $filter expression.
         */
        var sServiceUrl =
            this.getOwnerComponent()
                .getManifestEntry(
                    "/sap.app/dataSources/mainService/uri"
                );

        /*
         * Remove an existing query string from the service URL.
         * sap-client must be added as a separate query parameter,
         * never as part of the $filter expression.
         */
        var sBaseUrl = sServiceUrl.split("?")[0];

        var sSelect = [
            "ClearingArea",
            "PiDate",
            "PiNo",
            "TechStat",
            "PiKind",
            "Crusr",
            "Chusr",
            "Rlusr",
            "TrCurr",
            "TrAmount",
            "Holder",
            "RefRoute",
            "RefCustagr",
            "RefAmArea",
            "CheckAltCa",
            "PredetermRoute",
            "RpToDetermine",
            "RefAcctLocSrv",
            "RefItemExt",
            "Country",
            "Bic",
            "Iban",
            "AcctNo",
            "ValDate",
            "PiPostDate",
            "TransType",
            "RiskScore",
            "EndToEndId",
            "SettlementBic"
        ].join(",");

        var sFilter =
            "ClearingArea eq '" +
            String(sClearingArea).replace(/'/g, "''") +
            "' and PiPostDate eq " +
            sSelectedDate;

        /*
         * Build every query parameter separately.
         */
        var oParams = new URLSearchParams();

        oParams.set("$select", sSelect);
        oParams.set("$filter", sFilter);
        oParams.set("sap-client", "500");

        var sUrl =
            sBaseUrl +
            "Reconcilation?" +
            oParams.toString();

        console.log(
            "[Reconciliation] Fetch URL:",
            sUrl
        );

        var oResponse = await fetch(sUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        if (!oResponse.ok) {
            throw new Error(
                "HTTP " +
                oResponse.status +
                " - " +
                oResponse.statusText
            );
        }

        var oJson = await oResponse.json();

        var aRawData = [];

        if (oJson && Array.isArray(oJson.value)) {
            aRawData = oJson.value;
        }

        console.log(
            "[Reconciliation] Rows received:",
            aRawData.length
        );

        console.log(
            "[Reconciliation] Raw data sample:",
            aRawData.slice(0, 3)
        );

        this._processReconciliationData(aRawData);

    } catch (oError) {

        console.error(
            "[Reconciliation] OData load failed:",
            oError
        );

        MessageToast.show(
            "Error loading reconciliation data."
        );

        this._processReconciliationData([]);

    } finally {

        oReconModel.setProperty(
            "/busy",
            false
        );
    }
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

                this._debugTransactionFields(aRawData);

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

                var oModel = this.getView().getModel("reconciliation");

                var oGroupsMap = {};
                var aGroupOrder = [];

                var fTotalAmount = 0;
                var iTotalObjects = 0;

                var fDebitTotal = 0;
                var fCreditTotal = 0;

                var fPcReceived = 0;
                var fDmReceived = 0;

                var iPcCount = 0;
                var iDmCount = 0;
                var iUnknownCount = 0;


                // ============================================================
                // PROCESS ALL TRANSACTIONS
                // ============================================================

                (aRawData || []).forEach(function (oRow) {

                    if (!oRow) {
                        return;
                    }

                    var fAmount =
                        Number(oRow.TrAmount) || 0;

                    var sCurrency =
                        oRow.TrCurr || "";

                    var sDateKey =
                        oRow.PiPostDate ||
                        oRow.PiDate ||
                        "";

                    var sDirection =
                        "Credit";

                    var sDirectionState =
                        sDirection === "Credit"
                            ? "Success"
                            : "Error";


                    // ========================================================
                    // CLASSIFY TRANSACTION
                    // ========================================================

                    var sCategory =
                        this._getTransactionCategory(oRow);


                    // ========================================================
                    // PC / DM TOTALS
                    // ========================================================

                    if (sCategory === "PC") {

                        fPcReceived += fAmount;
                        iPcCount++;

                    } else if (sCategory === "DM") {

                        fDmReceived += fAmount;
                        iDmCount++;

                    } else {

                        iUnknownCount++;
                    }


                    // ========================================================
                    // GROUP KEY
                    // ========================================================

                    var sGroupKey =
                        sDateKey + "_" +
                        sCurrency + "_" +
                        sDirection;


                    // ========================================================
                    // CREATE GROUP
                    // ========================================================

                    if (!oGroupsMap[sGroupKey]) {

                        oGroupsMap[sGroupKey] = {

                            groupId: sGroupKey,

                            date: this._formatDate(sDateKey),

                            currency: sCurrency,

                            direction: sDirection,

                            directionState: sDirectionState,

                            // IMPORTANT:
                            // These names match the XML bindings
                            count: 0,

                            amount: 0,

                            expanded: false,

                            details: []
                        };

                        aGroupOrder.push(sGroupKey);
                    }


                    var oGroup =
                        oGroupsMap[sGroupKey];


                    // ========================================================
                    // UPDATE GROUP
                    // ========================================================

                    oGroup.count++;

                    oGroup.amount += fAmount;


                    // ========================================================
                    // KEEP ORIGINAL ODATA ROW
                    // ========================================================

                    var oDetail =
                        Object.assign({}, oRow);

                    // Store classification for future filtering
                    oDetail._reconCategory =
                        sCategory;

                    oGroup.details.push(
                        oDetail
                    );


                    // ========================================================
                    // KPI TOTALS
                    // ========================================================

                    fTotalAmount += fAmount;

                    iTotalObjects++;

                    fCreditTotal += fAmount;

                }.bind(this));


                // ============================================================
                // EXPAND FIRST GROUP
                // ============================================================

                if (aGroupOrder.length) {

                    oGroupsMap[
                        aGroupOrder[0]
                    ].expanded = true;
                }


                // ============================================================
                // CONVERT GROUP MAP TO ARRAY
                // ============================================================

                var aGroups =
                    aGroupOrder.map(function (sKey) {

                        return oGroupsMap[sKey];

                    });


                // ============================================================
                // RECONCILIATION GAP
                // ============================================================

                var fReconciliationGap =
                    Math.abs(
                        fPcReceived -
                        fDmReceived
                    );


                // ============================================================
                // CHART DATA
                // ============================================================

                var aChartData = [

                    {
                        Category: "PC Received",
                        Amount: fPcReceived
                    },

                    {
                        Category: "DM Received",
                        Amount: fDmReceived
                    },

                    {
                        Category: "Reconciliation Gap",
                        Amount: fReconciliationGap
                    }

                ];


                // ============================================================
                // RESULT
                // ============================================================

                var oResult = {

                    groups: aGroups,

                    kpi: {

                        totalAmount:
                            fTotalAmount.toFixed(2),

                        totalObjects:
                            String(iTotalObjects),

                        debitTotal:
                            fDebitTotal.toFixed(2),

                        creditTotal:
                            fCreditTotal.toFixed(2)
                    },

                    fPcReceived:
                        fPcReceived,

                    iPcCount:
                        iPcCount,

                    fDmPosted:
                        fDmReceived,

                    fDmReceived:
                        fDmReceived,

                    iDmCount:
                        iDmCount,

                    iUnknownCount:
                        iUnknownCount,

                    fReconciliationGap:
                        fReconciliationGap,

                    chartData:
                        aChartData
                };


                // ============================================================
                // UPDATE MODEL
                // ============================================================

                oModel.setProperty(
                    "/groups",
                    aGroups
                );

                oModel.setProperty(
                    "/kpi",
                    oResult.kpi
                );

                oModel.setProperty(
                    "/chartData",
                    aChartData
                );

                oModel.setProperty(
                    "/pcReceived",
                    fPcReceived
                );

                oModel.setProperty(
                    "/dmReceived",
                    fDmReceived
                );

                oModel.setProperty(
                    "/reconciliationGap",
                    fReconciliationGap
                );

                oModel.setProperty(
                    "/pcCount",
                    iPcCount
                );

                oModel.setProperty(
                    "/dmCount",
                    iDmCount
                );

                oModel.setProperty(
                    "/unknownCount",
                    iUnknownCount
                );


                console.log(
                    "[Reconciliation] Groups:",
                    aGroups
                );

                console.log(
                    "[Reconciliation] PC:",
                    fPcReceived,
                    "DM:",
                    fDmReceived
                );


                return oResult;
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

                if (!this._isValidSystemCombo()) {
                    return;
                }

                var aData =
                    oEvent.getParameter("data");

                if (!aData || !aData.length) {
                    return;
                }

                var oSelected =
                    aData[0].data;

                var sCategory =
                    oSelected.Category;

                this._applyChartCategoryFilter(
                    sCategory
                );
            },


            _applyChartCategoryFilter: function (sCategory) {

                var oReconModel =
                    this.getView().getModel("reconciliation");

                var aRawData =
                    this._aReconciliationRawData || [];


                // ============================================================
                // SAVE ORIGINAL CHART DATA
                //
                // The graph must NOT change when we filter the table.
                // ============================================================

                var aOriginalChartData =
                    oReconModel.getProperty("/chartData");


                var aFilteredRows = [];
                var sMessage = "";


                // ============================================================
                // PC RECEIVED
                // ============================================================

                if (
                    sCategory === "PC Received" ||
                    sCategory === "PC received"
                ) {

                    aFilteredRows =
                        aRawData.filter(function (oRow) {

                            return this._getTransactionCategory(oRow)
                                === "PC";

                        }.bind(this));


                    sMessage =
                        "Showing " +
                        aFilteredRows.length +
                        " PC Received transaction(s).";
                }


                // ============================================================
                // DM RECEIVED / DM POSTED
                // ============================================================

                else if (
                    sCategory === "DM Received" ||
                    sCategory === "DM received" ||
                    sCategory === "DM posted" ||
                    sCategory === "DM Posted"
                ) {

                    aFilteredRows =
                        aRawData.filter(function (oRow) {

                            return this._getTransactionCategory(oRow)
                                === "DM";

                        }.bind(this));


                    sMessage =
                        "Showing " +
                        aFilteredRows.length +
                        " DM transaction(s).";
                }


                // ============================================================
                // RECONCILIATION GAP
                // ============================================================

                else if (
                    sCategory === "Reconciliation Gap"
                ) {

                    /*
                     * Gap is not an actual transaction.
                     *
                     * It is:
                     *
                     * |PC Received - DM Received|
                     *
                     * Therefore show all transactions.
                     */

                    aFilteredRows =
                        aRawData;

                    sMessage =
                        "Reconciliation Gap is a calculated value. Showing all transactions.";
                }


                // ============================================================
                // UNKNOWN CATEGORY
                // ============================================================

                else {

                    aFilteredRows =
                        aRawData;

                    sMessage = "";
                }


                // ============================================================
                // REBUILD ONLY THE TABLE GROUPS
                // ============================================================

                var oResult =
                    this._buildGroupsAndKpi(
                        aFilteredRows
                    );


                // ============================================================
                // UPDATE TABLE
                // ============================================================

                oReconModel.setProperty(
                    "/groups",
                    oResult.groups
                );


                // ============================================================
                // RESTORE ORIGINAL GRAPH
                //
                // VERY IMPORTANT
                // ============================================================

                oReconModel.setProperty(
                    "/chartData",
                    aOriginalChartData
                );


                // ============================================================
                // UI STATE
                // ============================================================

                oReconModel.setProperty(
                    "/selectedCategory",
                    sCategory
                );

                oReconModel.setProperty(
                    "/filterMessage",
                    sMessage
                );


                console.log(
                    "[Reconciliation] Selected graph category:",
                    sCategory
                );

                console.log(
                    "[Reconciliation] Table rows after filter:",
                    aFilteredRows.length
                );
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

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {

                    MessageToast.show(
                        "Reconciliation data is not available."
                    );

                    return;
                }


                var aGroups =
                    oModel.getProperty(
                        "/groups"
                    ) || [];


                var aVisibleColumns =
                    oModel.getProperty(
                        "/visibleColumns"
                    ) || [];


                if (!aVisibleColumns.length) {

                    MessageToast.show(
                        "No columns selected."
                    );

                    return;
                }


                var aRows = [];


                aGroups.forEach(function (oGroup) {

                    if (
                        !oGroup.details ||
                        !oGroup.details.length
                    ) {
                        return;
                    }


                    oGroup.details.forEach(function (oDetail) {

                        var oExportRow = {};


                        aVisibleColumns.forEach(
                            function (oColumn) {

                                var vValue =
                                    oDetail[
                                    oColumn.key
                                    ];


                                /*
                                 * Format dates for Excel
                                 */
                                if (
                                    oColumn.type === "date" &&
                                    vValue
                                ) {

                                    vValue =
                                        this._formatDate(
                                            vValue
                                        );
                                }


                                oExportRow[
                                    oColumn.label
                                ] = vValue;

                            }.bind(this)
                        );


                        aRows.push(
                            oExportRow
                        );

                    }.bind(this));

                }.bind(this));


                if (!aRows.length) {

                    MessageToast.show(
                        "No reconciliation data to export."
                    );

                    return;
                }


                var aExcelColumns =
                    aVisibleColumns.map(
                        function (oColumn) {

                            return {

                                label:
                                    oColumn.label,

                                property:
                                    oColumn.label

                            };

                        }
                    );


                var oSettings = {

                    workbook: {

                        columns:
                            aExcelColumns
                    },

                    dataSource:
                        aRows,

                    fileName:
                        "Reconciliation_Details.xlsx"
                };


                var oSpreadsheet =
                    new Spreadsheet(
                        oSettings
                    );


                oSpreadsheet
                    .build()
                    .finally(function () {

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

                    var oResult =
                        this._buildGroupsAndKpi(
                            this._aReconciliationRawData || []
                        );

                    oReconModel.setProperty(
                        "/groups",
                        oResult.groups
                    );

                    oReconModel.setProperty(
                        "/kpi",
                        oResult.kpi
                    );

                    oReconModel.setProperty(
                        "/chartData",
                        oResult.chartData
                    );

                    oReconModel.setProperty(
                        "/selectedCategory",
                        ""
                    );

                    oReconModel.setProperty(
                        "/filterMessage",
                        ""
                    );

                    oReconModel.setProperty(
                        "/systemsBlocked",
                        false
                    );

                    oReconModel.setProperty(
                        "/systemsBlockedMessage",
                        ""
                    );
                }

                this._createReconChart();

            },

            /* ============================================================
        COLUMN SETTINGS
        ============================================================ */

            onReconColumnSettingsPress: function () {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel) {
                    return;
                }

                if (!this._oReconColumnDialog) {

                    var oSearchField = new SearchField({
                        width: "100%",
                        placeholder: "Search columns...",
                        liveChange: function (oEvent) {

                            var sQuery =
                                oEvent.getParameter("newValue") || "";

                            var oList =
                                this._oReconColumnList;

                            if (!oList) {
                                return;
                            }

                            oList.getItems().forEach(function (oItem) {

                                var oContext =
                                    oItem.getBindingContext("reconciliation");

                                if (!oContext) {
                                    return;
                                }

                                var sLabel =
                                    oContext.getProperty("label") || "";

                                var bVisible =
                                    sLabel
                                        .toLowerCase()
                                        .indexOf(
                                            sQuery.toLowerCase()
                                        ) !== -1;

                                oItem.setVisible(bVisible);
                            });
                        }
                    });

                    this._oReconColumnList =
                        new List({
                            mode: "None",
                            growing: false,
                            showSeparators: "Inner"
                        });

                    this._oReconColumnList.bindItems({
                        path: "reconciliation>/availableColumns",
                        factory: function (sId, oContext) {

                            var oCheckBox =
                                new CheckBox({
                                    text: "{reconciliation>label}",
                                    selected: "{reconciliation>selected}"
                                });

                            oCheckBox.attachSelect(
                                function (oEvent) {

                                    var oCtx =
                                        oEvent
                                            .getSource()
                                            .getBindingContext(
                                                "reconciliation"
                                            );

                                    if (!oCtx) {
                                        return;
                                    }

                                    oCtx.getModel().setProperty(
                                        oCtx.getPath() + "/selected",
                                        oEvent.getParameter(
                                            "selected"
                                        )
                                    );
                                }
                            );

                            return new CustomListItem({
                                content: [
                                    oCheckBox
                                ]
                            });
                        }
                    });

                    this._oReconColumnDialog =
                        new Dialog({

                            title: "Select Columns",

                            contentWidth: "420px",

                            contentHeight: "600px",

                            resizable: true,

                            draggable: true,

                            content: [
                                new sap.m.VBox({
                                    width: "100%",
                                    items: [

                                        oSearchField,

                                        this._oReconColumnList

                                    ]
                                })
                            ],

                            beginButton:
                                new Button({
                                    text: "Apply",
                                    type: "Emphasized",
                                    press: function () {

                                        this._applyReconColumnSettings();

                                        this._oReconColumnDialog.close();

                                    }.bind(this)
                                }),

                            endButton:
                                new Button({
                                    text: "Cancel",
                                    press: function () {

                                        this._resetTemporaryColumnSelection();

                                        this._oReconColumnDialog.close();

                                    }.bind(this)
                                }),

                            afterClose: function () {

                                if (oSearchField) {
                                    oSearchField.setValue("");
                                }

                                if (this._oReconColumnList) {

                                    this._oReconColumnList
                                        .getItems()
                                        .forEach(function (oItem) {

                                            oItem.setVisible(true);

                                        });
                                }

                            }.bind(this)
                        });

                    this.getView()
                        .addDependent(
                            this._oReconColumnDialog
                        );
                }

                /*
                 * Create temporary selection state
                 */
                var aColumns =
                    oModel.getProperty(
                        "/availableColumns"
                    ) || [];

                aColumns.forEach(function (oColumn) {

                    oColumn.selected =
                        this._isReconColumnVisible(
                            oColumn.key
                        );

                }.bind(this));

                oModel.setProperty(
                    "/availableColumns",
                    aColumns
                );

                this._oReconColumnDialog.open();
            },


            /* ============================================================
               APPLY COLUMN SETTINGS
               ============================================================ */

            _applyReconColumnSettings: function () {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel) {
                    return;
                }

                var aColumns =
                    oModel.getProperty(
                        "/availableColumns"
                    ) || [];

                var aSelected =
                    aColumns.filter(function (oColumn) {
                        return oColumn.selected === true;
                    });

                /*
                 * Do not allow an empty table.
                 */
                if (!aSelected.length) {

                    MessageToast.show(
                        "Select at least one column."
                    );

                    aColumns.forEach(function (oColumn) {

                        if (oColumn.defaultVisible) {
                            oColumn.selected = true;
                        }

                    });

                    aSelected =
                        aColumns.filter(function (oColumn) {
                            return oColumn.selected === true;
                        });
                }

                oModel.setProperty(
                    "/visibleColumns",
                    aSelected
                );

                this._refreshReconDetailTables();
            },


            /* ============================================================
               CHECK CURRENT VISIBILITY
               ============================================================ */

            _isReconColumnVisible: function (sKey) {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel) {
                    return false;
                }

                var aVisible =
                    oModel.getProperty(
                        "/visibleColumns"
                    ) || [];

                return aVisible.some(function (oColumn) {

                    return oColumn.key === sKey;

                });
            },


            /* ============================================================
               CANCEL SETTINGS
               ============================================================ */

            _resetTemporaryColumnSelection: function () {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel) {
                    return;
                }

                var aColumns =
                    oModel.getProperty(
                        "/availableColumns"
                    ) || [];

                aColumns.forEach(function (oColumn) {

                    oColumn.selected =
                        this._isReconColumnVisible(
                            oColumn.key
                        );

                }.bind(this));

                oModel.setProperty(
                    "/availableColumns",
                    aColumns
                );
            },

            /* ============================================================
               REFRESH ALL RECONCILIATION DETAIL TABLES
               ============================================================ */

            _refreshReconDetailTables: function () {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel) {
                    return;
                }

                var oList =
                    this.byId(
                        "reconciliationGroupList"
                    );

                if (!oList) {
                    return;
                }

                var aItems =
                    oList.getItems();

                aItems.forEach(function (oGroupItem) {

                    var aTables =
                        oGroupItem.findAggregatedObjects(
                            true,
                            function (oControl) {

                                return oControl.isA(
                                    "sap.m.Table"
                                ) &&
                                    oControl.getId()
                                        .indexOf(
                                            "reconciliationDetailTable"
                                        ) !== -1;

                            }
                        );

                    aTables.forEach(function (oTable) {

                        this._configureReconDetailTable(
                            oTable
                        );

                    }.bind(this));

                }.bind(this));
            },


            /* ============================================================
               CONFIGURE ONE DETAIL TABLE
               ============================================================ */

            _configureReconDetailTable: function (oTable) {

                var oModel =
                    this.getView().getModel("reconciliation");

                if (!oModel || !oTable) {
                    return;
                }

                var aColumns =
                    oModel.getProperty(
                        "/visibleColumns"
                    ) || [];

                /*
                 * Remove existing columns
                 */
                oTable.removeAllColumns();

                /*
                 * Remove existing item template
                 */
                oTable.unbindItems();

                /*
                 * Create dynamic columns
                 */
                aColumns.forEach(function (oColumnConfig) {

                    var oColumn =
                        new sap.m.Column({

                            // Fixed width prevents the table from compressing
                            // all columns when many fields are displayed.
                            width: "10rem",

                            hAlign:
                                oColumnConfig.type === "amount" ||
                                    oColumnConfig.type === "number"
                                    ? "End"
                                    : "Begin",

                            header:
                                new sap.m.Text({
                                    text: oColumnConfig.label
                                })
                        });

                    oTable.addColumn(oColumn);

                });


                /*
                 * Dynamic row template
                 */
                var oRow =
                    new sap.m.ColumnListItem({
                        type: "Inactive"
                    });


                aColumns.forEach(function (oColumnConfig) {

                    var oCell;

                    switch (oColumnConfig.type) {

                        case "amount":

                            oCell =
                                new sap.m.ObjectNumber({

                                    number: {
                                        path:
                                            "reconciliation>" +
                                            oColumnConfig.key,

                                        formatter:
                                            function (vValue) {

                                                if (
                                                    vValue === null ||
                                                    vValue === undefined ||
                                                    vValue === ""
                                                ) {
                                                    return "";
                                                }

                                                var n =
                                                    Number(vValue);

                                                return isNaN(n)
                                                    ? String(vValue)
                                                    : n.toFixed(2);
                                            }
                                    },

                                    unit: {
                                        path:
                                            "reconciliation>TrCurr"
                                    }

                                });

                            break;


                        case "number":

                            oCell =
                                new sap.m.ObjectNumber({

                                    number:
                                        "{reconciliation>" +
                                        oColumnConfig.key +
                                        "}"

                                });

                            break;


                        case "date":

                            oCell =
                                new sap.m.Text({

                                    text: {

                                        path:
                                            "reconciliation>" +
                                            oColumnConfig.key,

                                        formatter:
                                            function (vValue) {

                                                return this._formatDate(
                                                    vValue
                                                );

                                            }.bind(this)
                                    }

                                });

                            break;


                        default:

                            oCell =
                                new sap.m.Text({

                                    text:
                                        "{reconciliation>" +
                                        oColumnConfig.key +
                                        "}"

                                });

                            break;
                    }

                    oRow.addCell(oCell);

                }.bind(this));


                /*
                 * Bind directly to group's details
                 */
                oTable.bindItems({

                    path:
                        "reconciliation>details",

                    template:
                        oRow,

                    templateShareable:
                        false

                });
            },





            _debugTransactionFields: function (aData) {

                console.log("========== RECONCILIATION TRANSACTION ANALYSIS ==========");

                console.table(aData.map(function (oRow) {
                    return {
                        PiNo: oRow.PiNo,
                        PiKind: oRow.PiKind,
                        TechStat: oRow.TechStat,
                        TrCurr: oRow.TrCurr,
                        TrAmount: oRow.TrAmount,
                        RefRoute: oRow.RefRoute,
                        RefCustagr: oRow.RefCustagr,
                        RefAmArea: oRow.RefAmArea,
                        CheckAltCa: oRow.CheckAltCa,
                        PredetermRoute: oRow.PredetermRoute,
                        RpToDetermine: oRow.RpToDetermine,
                        RefAcctLocSrv: oRow.RefAcctLocSrv,
                        RefItemExt: oRow.RefItemExt,
                        TransType: oRow.TransType
                    };
                }));

                console.log("========== END TRANSACTION ANALYSIS ==========");
            },

            _getTransactionCategory: function (oRow) {

                if (
                    oRow.RefRoute === "SAP_DM" ||
                    oRow.RefAmArea === "SAP_DM"
                ) {
                    return "DM";
                }

                if (oRow.TechStat === "10") {
                    return "PC";
                }

                return "UNKNOWN";
            },

        }

    );

});