sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/Menu",
    "sap/m/MenuItem",
    "sap/ui/export/Spreadsheet",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (
    Controller,
    JSONModel,
    MessageToast,
    Menu,
    MenuItem,
    Spreadsheet,
    FlattenedDataset,
    DimensionDefinition,
    MeasureDefinition,
    FeedItem
) {

    "use strict";


    /* ============================================================
       CHART CONFIGURATION
       ============================================================ */

    var RECON_CHART_TYPE_CONFIG = {

        bar: {
            vizType: "bar",
            label: "Bar Chart",
            icon: "sap-icon://horizontal-bar-chart-2"
        },

        column: {
            vizType: "column",
            label: "Column Chart",
            icon: "sap-icon://vertical-bar-chart"
        },

        line: {
            vizType: "line",
            label: "Line Chart",
            icon: "sap-icon://line-chart"
        },

        pie: {
            vizType: "pie",
            label: "Pie Chart",
            icon: "sap-icon://pie-chart"
        },

        donut: {
            vizType: "donut",
            label: "Donut Chart",
            icon: "sap-icon://donut-chart"
        },

        heatmap: {
            vizType: "heatmap",
            label: "Heat Map",
            icon: "sap-icon://heatmap-chart"
        },

        stacked_bar: {
            vizType: "stacked_bar",
            label: "Stacked Bar Chart",
            icon: "sap-icon://horizontal-bar-chart"
        },

        stacked_column: {
            vizType: "stacked_column",
            label: "Stacked Column Chart",
            icon: "sap-icon://vertical-bar-chart-2"
        },

        "100_stacked_bar": {
            vizType: "100_stacked_bar",
            label: "100% Stacked Bar Chart",
            icon: "sap-icon://full-stacked-chart"
        },

        "100_stacked_column": {
            vizType: "100_stacked_column",
            label: "100% Stacked Column Chart",
            icon: "sap-icon://full-stacked-column-chart"
        }

    };


    return Controller.extend(
        "payment.dashboard.controller.Reconciliation",
        {

            /* ========================================================
               INIT
               ======================================================== */

            onInit: function () {

                var aGroups = [

                    {
                        groupId: "G001",
                        date: "02.03.2026",
                        currency: "EUR",
                        direction: "Credit",
                        directionState: "Success",
                        count: 22,
                        amount: 3680.01,
                        expanded: true,

                        details: [

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "142746",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 2,
                                ReconciliationAmount: 90.00
                            },

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "142776",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            },

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "167038",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            }

                        ]
                    },


                    {
                        groupId: "G002",
                        date: "02.03.2026",
                        currency: "EUR",
                        direction: "Debit",
                        directionState: "Error",
                        count: 13,
                        amount: 3785.01,
                        expanded: false,

                        details: [

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "PAYEN",
                                AddId: "142608",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "01",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 1000.00
                            },

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "PAYEN",
                                AddId: "142612",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "01",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 1000.00
                            }

                        ]
                    },


                    {
                        groupId: "G003",
                        date: "07.04.2026",
                        currency: "EUR",
                        direction: "Credit",
                        directionState: "Success",
                        count: 42,
                        amount: 2016.00,
                        expanded: false,

                        details: [

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "262905",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            },

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "262918",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            }

                        ]
                    },


                    {
                        groupId: "G004",
                        date: "07.04.2026",
                        currency: "EUR",
                        direction: "Debit",
                        directionState: "Error",
                        count: 19,
                        amount: 912.00,
                        expanded: false,

                        details: [

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "262905",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "01",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            },

                            {
                                AccountManagement: "SAP_DM",
                                SystemId: "IFS 500",
                                ApplicationId: "0030",
                                AddId: "262918",
                                ReconciliationGroupKey: "BAS",
                                PaymentItemCategory: "03",
                                ReconciliationObjects: 1,
                                ReconciliationAmount: 48.00
                            }

                        ]
                    }

                ];


                /* ========================================================
                   MODEL DATA
                   ======================================================== */

                var oData = {

                    kpi: {

                        totalAmount: "30997.02",

                        totalObjects: "145",

                        debitTotal: "13405.01",

                        creditTotal: "17592.01"

                    },


                    /*
                     * THIS IS THE RECONCILIATION CHART DATA.
                     *
                     * DO NOT CHANGE Category TO Direction.
                     */

                    chartData: [

                        {
                            Category: "PC received",
                            Amount: 10000
                        },

                        {
                            Category: "DM posted",
                            Amount: 9800
                        },

                        {
                            Category: "Reconciliation gap",
                            Amount: 200
                        }

                    ],


                    filters: {

                        system1: "",

                        system2: ""

                    },


                    groups: aGroups

                };


                /* ========================================================
                   CREATE MODEL
                   ======================================================== */

                var oModel =
                    new JSONModel(oData);

                oModel.setSizeLimit(1000);

                this.getView().setModel(
                    oModel,
                    "reconciliation"
                );


                /* ========================================================
                   DEFAULT CHART TYPE
                   ======================================================== */

                this._sActiveReconChartType =
                    "column";


                /* ========================================================
                   CREATE CHART AFTER RENDERING
                   ======================================================== */

                this.getView().addEventDelegate({

                    onAfterRendering: function () {

                        setTimeout(

                            function () {

                                this._createReconChart();

                                this._updateSystem2Availability();

                            }.bind(this),

                            300

                        );

                    }.bind(this)

                });

            },


            /* ============================================================
               SYSTEM 1 CHANGE
               ============================================================ */

            onSystem1Change: function (oEvent) {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }


                var sSystem1 =
                    oEvent
                        .getSource()
                        .getSelectedKey();


                var sSystem2 =
                    oModel.getProperty(
                        "/filters/system2"
                    );


                if (
                    sSystem1 &&
                    sSystem1 === sSystem2
                ) {

                    MessageToast.show(
                        "System 1 and System 2 cannot be the same."
                    );

                    oEvent
                        .getSource()
                        .setSelectedKey("");


                    oModel.setProperty(
                        "/filters/system1",
                        ""
                    );


                    this._updateSystem2Availability();

                    return;

                }


                oModel.setProperty(
                    "/filters/system1",
                    sSystem1
                );


                this._updateSystem2Availability();

                this._applySystemFilters();

            },


            /* ============================================================
               SYSTEM 2 CHANGE
               ============================================================ */

            onSystem2Change: function (oEvent) {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }


                var sSystem2 =
                    oEvent
                        .getSource()
                        .getSelectedKey();


                var sSystem1 =
                    oModel.getProperty(
                        "/filters/system1"
                    );


                if (
                    sSystem2 &&
                    sSystem2 === sSystem1
                ) {

                    MessageToast.show(
                        "System 1 and System 2 cannot be the same."
                    );

                    oEvent
                        .getSource()
                        .setSelectedKey("");


                    oModel.setProperty(
                        "/filters/system2",
                        ""
                    );

                    return;

                }


                oModel.setProperty(
                    "/filters/system2",
                    sSystem2
                );


                this._applySystemFilters();

            },


            /* ============================================================
               ENABLE / DISABLE SYSTEM 2
               ============================================================ */

            _updateSystem2Availability: function () {

                var oSystem1 =
                    this.byId(
                        "system1Select"
                    );

                var oSystem2 =
                    this.byId(
                        "system2Select"
                    );

                var oDMItem =
                    this.byId(
                        "system2DMItem"
                    );


                if (
                    !oSystem1 ||
                    !oSystem2 ||
                    !oDMItem
                ) {
                    return;
                }


                var sSystem1 =
                    oSystem1.getSelectedKey();


                if (sSystem1 === "DM") {

                    oDMItem.setEnabled(false);

                    oSystem2.setSelectedKey("");


                    var oModel =
                        this.getView().getModel(
                            "reconciliation"
                        );


                    if (oModel) {

                        oModel.setProperty(
                            "/filters/system2",
                            ""
                        );

                    }

                } else {

                    oDMItem.setEnabled(true);

                }

            },


            /* ============================================================
               APPLY FILTER
               ============================================================ */

            _applySystemFilters: function () {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }


                var sSystem1 =
                    oModel.getProperty(
                        "/filters/system1"
                    );

                var sSystem2 =
                    oModel.getProperty(
                        "/filters/system2"
                    );


                console.log(
                    "Reconciliation System 1:",
                    sSystem1
                );

                console.log(
                    "Reconciliation System 2:",
                    sSystem2
                );


                if (
                    sSystem1 === "PC" &&
                    sSystem2 === "DM"
                ) {

                    console.log(
                        "Valid reconciliation flow: PC → DM"
                    );

                }

            },


            /* ============================================================
               RESET
               ============================================================ */

            onResetSystemFilters: function () {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }


                oModel.setProperty(
                    "/filters/system1",
                    ""
                );

                oModel.setProperty(
                    "/filters/system2",
                    ""
                );


                var oSystem1 =
                    this.byId(
                        "system1Select"
                    );

                var oSystem2 =
                    this.byId(
                        "system2Select"
                    );


                if (oSystem1) {
                    oSystem1.setSelectedKey("");
                }

                if (oSystem2) {
                    oSystem2.setSelectedKey("");
                }


                this._updateSystem2Availability();


                MessageToast.show(
                    "Reconciliation filters reset"
                );

            },


            /* ============================================================
               GROUP EXPANSION
               ============================================================ */

            onToggleGroup: function (oEvent) {

                var oContext =
                    oEvent
                        .getSource()
                        .getBindingContext(
                            "reconciliation"
                        );


                if (!oContext) {
                    return;
                }


                var bExpanded =
                    oContext.getProperty(
                        "expanded"
                    );


                oContext
                    .getModel()
                    .setProperty(
                        oContext.getPath() +
                        "/expanded",
                        !bExpanded
                    );

            },


            /* ============================================================
               CREATE RECONCILIATION CHART
               ============================================================ */

            _createReconChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {

                    console.error(
                        "Reconciliation VizFrame not found."
                    );

                    return;

                }


                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );


                if (!oModel) {
                    return;
                }


                var aChartData =
                    oModel.getProperty(
                        "/chartData"
                    );


                console.log(
                    "RECONCILIATION CHART DATA:",
                    aChartData
                );


                if (
                    !Array.isArray(aChartData) ||
                    !aChartData.length
                ) {

                    console.error(
                        "Reconciliation chart data is empty."
                    );

                    return;

                }


                /* ====================================================
                   REMOVE OLD DATASET
                   ==================================================== */

                var oOldDataset =
                    oChart.getDataset();


                if (oOldDataset) {

                    oChart.setDataset(null);

                    oOldDataset.destroy();

                }


                /* ====================================================
                   REMOVE OLD FEEDS
                   ==================================================== */

                oChart.removeAllFeeds();


                /* ====================================================
                   DATASET

                   IMPORTANT:
                   Category -> Category
                   Amount   -> Amount
                   ==================================================== */

                var oDataset =
                    new FlattenedDataset({

                        data: {
                            path: "/chartData"
                        },


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


                oChart.setModel(
                    oModel
                );


                oChart.setDataset(
                    oDataset
                );


                /* ====================================================
                   DEFAULT CHART
                   ==================================================== */

                oChart.setVizType(
                    "column"
                );


                this._configureReconChart(
                    "column"
                );


                console.log(
                    "Reconciliation chart created successfully."
                );

            },


            /* ============================================================
               CHART TYPE MENU
               ============================================================ */

            onReconChartTypeMenuPress: function (oEvent) {

                var oButton =
                    oEvent.getSource();


                if (!this._oReconChartTypeMenu) {

                    var aItems =
                        Object.keys(
                            RECON_CHART_TYPE_CONFIG
                        ).map(

                            function (sKey) {

                                var oConfig =
                                    RECON_CHART_TYPE_CONFIG[
                                        sKey
                                    ];


                                var oItem =
                                    new MenuItem({

                                        text:
                                            oConfig.label,

                                        icon:
                                            oConfig.icon

                                    });


                                oItem.data(
                                    "configKey",
                                    sKey
                                );


                                return oItem;

                            }.bind(this)

                        );


                    this._oReconChartTypeMenu =
                        new Menu({

                            items: aItems,

                            itemSelected:
                                this
                                    .onReconChartTypeSelected
                                    .bind(this)

                        });


                    this.getView().addDependent(
                        this._oReconChartTypeMenu
                    );

                }


                this._oReconChartTypeMenu.openBy(
                    oButton
                );

            },


            /* ============================================================
               CHART TYPE SELECTED
               ============================================================ */

            onReconChartTypeSelected: function (oEvent) {

                var oItem =
                    oEvent.getParameter(
                        "item"
                    );


                if (!oItem) {
                    return;
                }


                var sChartType =
                    oItem.data(
                        "configKey"
                    );


                if (!sChartType) {
                    return;
                }


                this._applyReconChartType(
                    sChartType
                );

            },


            /* ============================================================
               APPLY CHART TYPE
               ============================================================ */

            _applyReconChartType: function (sChartType) {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {
                    return;
                }


                var oConfig =
                    RECON_CHART_TYPE_CONFIG[
                        sChartType
                    ];


                if (!oConfig) {
                    return;
                }


                this._sActiveReconChartType =
                    sChartType;


                var oButton =
                    this.byId(
                        "reconChartTypeButton"
                    );


                if (oButton) {

                    oButton.setIcon(
                        oConfig.icon
                    );

                    oButton.setTooltip(
                        oConfig.label
                    );

                }


                oChart.setVizType(
                    oConfig.vizType
                );


                this._configureReconChart(
                    sChartType
                );

            },


            /* ============================================================
               CONFIGURE CHART
               ============================================================ */

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


            /* ============================================================
               BAR / COLUMN / LINE / STACKED
               ============================================================ */

            _configureReconAxisChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {
                    return;
                }


                oChart.removeAllFeeds();


                /*
                 * IMPORTANT:
                 *
                 * Use Category here.
                 *
                 * NOT Direction.
                 */

                oChart.addFeed(

                    new FeedItem({

                        uid: "categoryAxis",

                        type: "Dimension",

                        values: [
                            "Category"
                        ]

                    })

                );


                oChart.addFeed(

                    new FeedItem({

                        uid: "valueAxis",

                        type: "Measure",

                        values: [
                            "Amount"
                        ]

                    })

                );


                oChart.setVizProperties({

                    title: {
                        visible: false
                    },


                    legend: {
                        visible: false
                    },


                    plotArea: {

                        dataLabel: {

                            visible: true,

                            formatString:
                                "#,##0.00"

                        },

                        drawingEffect:
                            "glossy"

                    },


                    categoryAxis: {

                        title: {

                            visible: false

                        },

                        label: {

                            visible: true

                        }

                    },


                    valueAxis: {

                        title: {

                            visible: true,

                            text: "Amount (EUR)"

                        },

                        label: {

                            formatString:
                                "#,##0"

                        }

                    }

                });


                oChart.invalidate();

                oChart.rerender();

            },


            /* ============================================================
               PIE
               ============================================================ */

            _configureReconPieChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {
                    return;
                }


                oChart.removeAllFeeds();


                oChart.addFeed(

                    new FeedItem({

                        uid: "color",

                        type: "Dimension",

                        values: [
                            "Category"
                        ]

                    })

                );


                oChart.addFeed(

                    new FeedItem({

                        uid: "size",

                        type: "Measure",

                        values: [
                            "Amount"
                        ]

                    })

                );


                oChart.setVizProperties({

                    title: {
                        visible: false
                    },


                    legend: {

                        visible: true,

                        position: "right"

                    },


                    plotArea: {

                        dataLabel: {

                            visible: true,

                            formatString:
                                "#,##0.00"

                        }

                    }

                });


                oChart.invalidate();

                oChart.rerender();

            },


            /* ============================================================
               DONUT
               ============================================================ */

            _configureReconDonutChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {
                    return;
                }


                oChart.removeAllFeeds();


                oChart.addFeed(

                    new FeedItem({

                        uid: "color",

                        type: "Dimension",

                        values: [
                            "Category"
                        ]

                    })

                );


                oChart.addFeed(

                    new FeedItem({

                        uid: "size",

                        type: "Measure",

                        values: [
                            "Amount"
                        ]

                    })

                );


                oChart.setVizProperties({

                    title: {
                        visible: false
                    },


                    legend: {

                        visible: true,

                        position: "right"

                    },


                    plotArea: {

                        dataLabel: {

                            visible: true

                        }

                    }

                });


                oChart.invalidate();

                oChart.rerender();

            },


            /* ============================================================
               HEATMAP
               ============================================================ */

            _configureReconHeatmapChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {
                    return;
                }


                oChart.removeAllFeeds();


                oChart.addFeed(

                    new FeedItem({

                        uid: "categoryAxis",

                        type: "Dimension",

                        values: [
                            "Category"
                        ]

                    })

                );


                oChart.addFeed(

                    new FeedItem({

                        uid: "color",

                        type: "Measure",

                        values: [
                            "Amount"
                        ]

                    })

                );


                oChart.setVizProperties({

                    title: {
                        visible: false
                    },


                    legend: {
                        visible: true
                    }

                });


                oChart.invalidate();

                oChart.rerender();

            },


            /* ============================================================
               CHART SELECTION
               ============================================================ */

            onReconciliationChartSelect: function (oEvent) {

                var aData =
                    oEvent.getParameter(
                        "data"
                    );


                if (
                    !aData ||
                    !aData.length
                ) {
                    return;
                }


                console.log(
                    "Selected reconciliation data:",
                    aData[0].data
                );

            },


            /* ============================================================
               EXPORT EXCEL
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


                var aRows = [];


                aGroups.forEach(

                    function (oGroup) {

                        if (
                            !oGroup.details ||
                            !oGroup.details.length
                        ) {
                            return;
                        }


                        oGroup.details.forEach(

                            function (oDetail) {

                                aRows.push({

                                    Date:
                                        oGroup.date,

                                    Currency:
                                        oGroup.currency,

                                    Direction:
                                        oGroup.direction,

                                    AccountManagement:
                                        oDetail.AccountManagement,

                                    SystemId:
                                        oDetail.SystemId,

                                    ApplicationId:
                                        oDetail.ApplicationId,

                                    AddId:
                                        oDetail.AddId,

                                    ReconciliationGroupKey:
                                        oDetail.ReconciliationGroupKey,

                                    PaymentItemCategory:
                                        oDetail.PaymentItemCategory,

                                    ReconciliationObjects:
                                        oDetail.ReconciliationObjects,

                                    ReconciliationAmount:
                                        oDetail.ReconciliationAmount

                                });

                            }

                        );

                    }

                );


                if (!aRows.length) {

                    MessageToast.show(
                        "No reconciliation data to export."
                    );

                    return;

                }


                var aColumns = [

                    {
                        label: "Date",
                        property: "Date"
                    },

                    {
                        label: "Currency",
                        property: "Currency"
                    },

                    {
                        label: "Direction",
                        property: "Direction"
                    },

                    {
                        label: "Acct Mgmt",
                        property: "AccountManagement"
                    },

                    {
                        label: "System ID",
                        property: "SystemId"
                    },

                    {
                        label: "Appl. ID",
                        property: "ApplicationId"
                    },

                    {
                        label: "Add. ID",
                        property: "AddId"
                    },

                    {
                        label: "Reconc. Grp Key",
                        property: "ReconciliationGroupKey"
                    },

                    {
                        label: "Payment Item Category",
                        property: "PaymentItemCategory"
                    },

                    {
                        label: "No. of Rcn Obj.",
                        property: "ReconciliationObjects"
                    },

                    {
                        label: "Recon. Amount",
                        property: "ReconciliationAmount"
                    }

                ];


                var oSettings = {

                    workbook: {

                        columns:
                            aColumns

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
                    .finally(

                        function () {

                            oSpreadsheet.destroy();

                        }

                    );

            }

        }

    );

});