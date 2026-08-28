sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (
    Controller,
    JSONModel,
    MessageToast,
    Spreadsheet,
    FlattenedDataset,
    DimensionDefinition,
    MeasureDefinition,
    FeedItem
) {

    "use strict";

    return Controller.extend(
        "payment.dashboard.controller.Reconciliation",
        {

            // ============================================================
            // INITIALIZATION
            // ============================================================

            onInit: function () {

                // --------------------------------------------------------
                // RECONCILIATION GROUP DATA
                // --------------------------------------------------------

                var aGroups = [

                    // ====================================================
                    // G001 - CREDIT
                    // ====================================================

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


                    // ====================================================
                    // G002 - DEBIT
                    // ====================================================

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


                    // ====================================================
                    // G003 - CREDIT
                    // ====================================================

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


                    // ====================================================
                    // G004 - DEBIT
                    // ====================================================

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


                // ========================================================
                // MODEL DATA
                // ========================================================

                var oData = {

                    // ----------------------------------------------------
                    // KPI VALUES
                    // ----------------------------------------------------

                    kpi: {

                        totalAmount: "30997.02",

                        totalObjects: "145",

                        debitTotal: "13405.01",

                        creditTotal: "17592.01"

                    },


                    // ----------------------------------------------------
                    // RECONCILIATION CHART
                    // ----------------------------------------------------

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


                    // ----------------------------------------------------
                    // SYSTEM FILTERS
                    // ----------------------------------------------------

                    filters: {

                        system1: "",

                        system2: ""

                    },


                    // ----------------------------------------------------
                    // RECONCILIATION DETAILS
                    // ----------------------------------------------------

                    groups: aGroups

                };


                // ========================================================
                // CREATE MODEL
                // ========================================================

                var oModel = new JSONModel(oData);

                oModel.setSizeLimit(1000);

                this.getView().setModel(
                    oModel,
                    "reconciliation"
                );


                // ========================================================
                // CREATE CHART AFTER VIEW RENDERING
                // ========================================================

                this.getView().addEventDelegate({

                    onAfterRendering: function () {

                        setTimeout(
                            function () {

                                this._createBarChart();

                                this._updateSystem2Availability();

                            }.bind(this),
                            300
                        );

                    }.bind(this)

                });

            },


            // ============================================================
            // SYSTEM 1 CHANGE
            // ============================================================

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


                // --------------------------------------------------------
                // PREVENT SAME SYSTEM
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // SAVE SELECTION
                // --------------------------------------------------------

                oModel.setProperty(
                    "/filters/system1",
                    sSystem1
                );


                // --------------------------------------------------------
                // UPDATE SYSTEM 2
                // --------------------------------------------------------

                this._updateSystem2Availability();


                // --------------------------------------------------------
                // APPLY FILTER
                // --------------------------------------------------------

                this._applySystemFilters();

            },


            // ============================================================
            // SYSTEM 2 CHANGE
            // ============================================================

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


                // --------------------------------------------------------
                // PREVENT SAME SYSTEM
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // SAVE SELECTION
                // --------------------------------------------------------

                oModel.setProperty(
                    "/filters/system2",
                    sSystem2
                );


                // --------------------------------------------------------
                // APPLY FILTER
                // --------------------------------------------------------

                this._applySystemFilters();

            },


            // ============================================================
            // UPDATE SYSTEM 2 AVAILABILITY
            // ============================================================

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


                // --------------------------------------------------------
                // SYSTEM 1 = DM
                // SYSTEM 2 = DM NOT ALLOWED
                // --------------------------------------------------------

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

                }

                // --------------------------------------------------------
                // SYSTEM 1 = PC
                // SYSTEM 2 = DM ALLOWED
                // --------------------------------------------------------

                else {

                    oDMItem.setEnabled(true);

                }

            },


            // ============================================================
            // APPLY SYSTEM FILTERS
            // ============================================================

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


                // --------------------------------------------------------
                // NO FILTER
                // --------------------------------------------------------

                if (
                    !sSystem1 &&
                    !sSystem2
                ) {

                    console.log(
                        "No reconciliation system filter selected."
                    );

                    return;
                }


                // --------------------------------------------------------
                // PC -> DM
                // --------------------------------------------------------

                if (
                    sSystem1 === "PC" &&
                    sSystem2 === "DM"
                ) {

                    console.log(
                        "Valid reconciliation flow: PC → DM"
                    );

                    return;
                }


                // --------------------------------------------------------
                // SYSTEM 1 ONLY
                // --------------------------------------------------------

                if (
                    sSystem1 &&
                    !sSystem2
                ) {

                    console.log(
                        "System 1 selected:",
                        sSystem1
                    );

                    return;
                }

            },


            // ============================================================
            // RESET FILTERS
            // ============================================================

            onResetSystemFilters: function () {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }


                // --------------------------------------------------------
                // RESET MODEL
                // --------------------------------------------------------

                oModel.setProperty(
                    "/filters/system1",
                    ""
                );

                oModel.setProperty(
                    "/filters/system2",
                    ""
                );


                // --------------------------------------------------------
                // RESET CONTROLS
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // ENABLE SYSTEM 2 DM AGAIN
                // --------------------------------------------------------

                this._updateSystem2Availability();


                MessageToast.show(
                    "Reconciliation filters reset"
                );

            },


            // ============================================================
            // GROUP EXPANSION
            // ============================================================

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


                var sPath =
                    oContext.getPath();


                var bExpanded =
                    oContext.getProperty(
                        "expanded"
                    );


                oContext
                    .getModel()
                    .setProperty(
                        sPath + "/expanded",
                        !bExpanded
                    );

            },


            // ============================================================
            // CREATE BAR CHART
            // ============================================================

            _createBarChart: function () {

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );


                if (!oChart) {

                    console.error(
                        "Reconciliation chart not found."
                    );

                    return;

                }


                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );


                if (!oModel) {

                    console.error(
                        "Reconciliation model not found."
                    );

                    return;

                }


                var aChartData =
                    oModel.getProperty(
                        "/chartData"
                    );


                if (
                    !Array.isArray(aChartData) ||
                    aChartData.length === 0
                ) {

                    console.error(
                        "Reconciliation chart data is empty."
                    );

                    return;

                }


                // --------------------------------------------------------
                // REMOVE EXISTING DATASET
                // --------------------------------------------------------

                var oOldDataset =
                    oChart.getDataset();


                if (oOldDataset) {

                    oChart.setDataset(null);

                    oOldDataset.destroy();

                }


                // --------------------------------------------------------
                // REMOVE EXISTING FEEDS
                // --------------------------------------------------------

                oChart.removeAllFeeds();


                // --------------------------------------------------------
                // DATASET
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // MODEL
                // --------------------------------------------------------

                oChart.setModel(
                    oModel
                );


                // --------------------------------------------------------
                // DATASET
                // --------------------------------------------------------

                oChart.setDataset(
                    oDataset
                );


                // --------------------------------------------------------
                // CATEGORY FEED
                // --------------------------------------------------------

                var oCategoryFeed =
                    new FeedItem({

                        uid: "categoryAxis",

                        type: "Dimension",

                        values: [
                            "Category"
                        ]

                    });


                oChart.addFeed(
                    oCategoryFeed
                );


                // --------------------------------------------------------
                // VALUE FEED
                // --------------------------------------------------------

                var oValueFeed =
                    new FeedItem({

                        uid: "valueAxis",

                        type: "Measure",

                        values: [
                            "Amount"
                        ]

                    });


                oChart.addFeed(
                    oValueFeed
                );


                // --------------------------------------------------------
                // CHART TYPE
                // --------------------------------------------------------

                oChart.setVizType(
                    "column"
                );


                // --------------------------------------------------------
                // SIZE
                // --------------------------------------------------------

                oChart.setWidth(
                    "100%"
                );

                oChart.setHeight(
                    "400px"
                );


                // --------------------------------------------------------
                // CHART PROPERTIES
                // --------------------------------------------------------

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

                            showTotal: false,

                            formatString: "#,##0.00"

                        },

                        drawingEffect: "glossy"

                    },

                    valueAxis: {

                        title: {

                            visible: true,

                            text: "Amount (EUR)"

                        },

                        label: {

                            formatString: "#,##0"

                        },

                        scale: {

                            fixedRange: false

                        }

                    },

                    categoryAxis: {

                        title: {

                            visible: false

                        },

                        label: {

                            visible: true

                        }

                    },

                    interaction: {

                        selectability: {

                            mode: "single"

                        }

                    }

                });


                // --------------------------------------------------------
                // CHART SELECTION
                // --------------------------------------------------------

                oChart.detachSelectData(
                    this.onReconciliationChartSelect,
                    this
                );


                oChart.attachSelectData(
                    this.onReconciliationChartSelect,
                    this
                );


                // --------------------------------------------------------
                // RENDER
                // --------------------------------------------------------

                oChart.invalidate();

                oChart.rerender();


                console.log(
                    "Reconciliation bar chart rendered."
                );

            },


            // ============================================================
            // CHART SELECTION
            // ============================================================

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
                    "Selected reconciliation metric:",
                    aData[0].data
                );

            },


            // ============================================================
            // EXPORT TO EXCEL
            // ============================================================

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


                // --------------------------------------------------------
                // FLATTEN GROUP DETAILS
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // NO DATA
                // --------------------------------------------------------

                if (!aRows.length) {

                    MessageToast.show(
                        "No reconciliation data to export."
                    );

                    return;

                }


                // --------------------------------------------------------
                // EXCEL COLUMNS
                // --------------------------------------------------------

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


                // --------------------------------------------------------
                // EXCEL SETTINGS
                // --------------------------------------------------------

                var oSettings = {

                    workbook: {

                        columns: aColumns

                    },

                    dataSource: aRows,

                    fileName:
                        "Reconciliation_Details.xlsx"

                };


                // --------------------------------------------------------
                // CREATE EXCEL
                // --------------------------------------------------------

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