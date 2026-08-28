sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (
    Controller,
    JSONModel,
    MessageToast,
    Spreadsheet,
    library,
    FlattenedDataset,
    DimensionDefinition,
    MeasureDefinition,
    FeedItem
) {

    "use strict";

    var EdmType = library.EdmType;

    return Controller.extend(
        "payment.dashboard.controller.Reconciliation",
        {

            // ============================================================
            // INIT
            // ============================================================

            onInit: function () {

                /*
                 * KEEP YOUR EXISTING aGroups ARRAY HERE.
                 *
                 * Your existing groups are:
                 *
                 * G001 - 02.03.2026 - Credit
                 * G002 - 02.03.2026 - Debit
                 * G003 - 07.04.2026 - Credit
                 * G004 - 07.04.2026 - Debit
                 *
                 * Do not change that data.
                 */

                var aGroups = [
                    // ====================================================
                    // PASTE YOUR EXISTING aGroups DATA HERE
                    // ====================================================

                    // G001
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
                    // G002
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
                    // G003
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
                    // G004
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

                    kpi: {
                        totalAmount: "30997.02",
                        totalObjects: "145",
                        debitTotal: "13405.01",
                        creditTotal: "17592.01"
                    },

                    /*
                     * THIS IS THE DATA FOR THE RECONCILIATION GRAPH.
                     *
                     * These are the three bars that should appear:
                     *
                     * PC received          10,000
                     * DM posted              9,800
                     * Reconciliation gap       200
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

                    /*
                     * Filter values
                     */

                    filter: {
                        clearingArea: "DEBNKC",
                        systemId: "",
                        dateFrom: "",
                        dateTo: ""
                    },

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

                console.log(
                    "===================================="
                );

                console.log(
                    "RECONCILIATION MODEL CREATED"
                );

                console.log(
                    "Chart Data:",
                    oModel.getProperty("/chartData")
                );

                console.log(
                    "Groups:",
                    oModel.getProperty("/groups")
                );

                console.log(
                    "===================================="
                );

                // ========================================================
                // CREATE CHART AFTER VIEW RENDERING
                // ========================================================

                this.getView().addEventDelegate({

                    onAfterRendering: function () {

                        setTimeout(
                            function () {

                                this._createBarChart();

                            }.bind(this),
                            300
                        );

                    }.bind(this)

                });

            },


            // ============================================================
            // SEARCH / FILTER
            // ============================================================

            onSearch: function () {

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {
                    return;
                }

                var sClearingArea =
                    oModel.getProperty(
                        "/filter/clearingArea"
                    );

                var sSystemId =
                    oModel.getProperty(
                        "/filter/systemId"
                    );

                var sDateFrom =
                    oModel.getProperty(
                        "/filter/dateFrom"
                    );

                var sDateTo =
                    oModel.getProperty(
                        "/filter/dateTo"
                    );

                console.log(
                    "Reconciliation filters:",
                    {
                        clearingArea: sClearingArea,
                        systemId: sSystemId,
                        dateFrom: sDateFrom,
                        dateTo: sDateTo
                    }
                );

                MessageToast.show(
                    "Reconciliation data refreshed"
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
            // BAR CHART
            // ============================================================

            _createBarChart: function () {

                console.log(
                    "===================================="
                );

                console.log(
                    "CREATE RECONCILIATION BAR CHART"
                );

                console.log(
                    "===================================="
                );

                // ========================================================
                // GET VIZFRAME
                // ========================================================

                var oChart =
                    this.byId(
                        "reconciliationBarVizFrame"
                    );

                if (!oChart) {

                    console.error(
                        "❌ reconciliationBarVizFrame NOT FOUND"
                    );

                    return;
                }

                console.log(
                    "✅ VizFrame found:",
                    oChart.getId()
                );


                // ========================================================
                // GET MODEL
                // ========================================================

                var oModel =
                    this.getView().getModel(
                        "reconciliation"
                    );

                if (!oModel) {

                    console.error(
                        "❌ reconciliation model NOT FOUND"
                    );

                    return;
                }


                // ========================================================
                // GET CHART DATA
                // ========================================================

                var aChartData =
                    oModel.getProperty(
                        "/chartData"
                    );

                console.log(
                    "BAR CHART DATA:",
                    JSON.stringify(
                        aChartData
                    )
                );


                if (
                    !Array.isArray(
                        aChartData
                    ) ||
                    aChartData.length === 0
                ) {

                    console.error(
                        "❌ BAR CHART DATA EMPTY"
                    );

                    return;
                }


                // ========================================================
                // CLEAN OLD DATASET
                // ========================================================

                var oOldDataset =
                    oChart.getDataset();

                if (oOldDataset) {

                    oChart.setDataset(null);

                    oOldDataset.destroy();

                }


                // ========================================================
                // CLEAN OLD FEEDS
                // ========================================================

                oChart.removeAllFeeds();


                // ========================================================
                // DATASET
                // ========================================================

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


                console.log(
                    "✅ Dataset created"
                );


                // ========================================================
                // SET MODEL
                // ========================================================

                oChart.setModel(
                    oModel
                );


                // ========================================================
                // SET DATASET
                // ========================================================

                oChart.setDataset(
                    oDataset
                );


                console.log(
                    "✅ Dataset attached"
                );


                // ========================================================
                // CATEGORY AXIS
                // ========================================================

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


                // ========================================================
                // VALUE AXIS
                // ========================================================

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


                console.log(
                    "✅ Feeds attached"
                );


                // ========================================================
                // CHART TYPE
                // ========================================================

                oChart.setVizType(
                    "column"
                );


                // ========================================================
                // SIZE
                // ========================================================

                oChart.setWidth(
                    "100%"
                );

                oChart.setHeight(
                    "400px"
                );


                // ========================================================
                // VIZ PROPERTIES
                // ========================================================

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

                            formatString: "#,##0"

                        },

                        /*
                         * Gives the columns rounded corners
                         * where supported by the VizFrame renderer.
                         */

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


                // ========================================================
                // SELECTION
                // ========================================================

                oChart.detachSelectData(
                    this.onReconciliationChartSelect,
                    this
                );

                oChart.attachSelectData(
                    this.onReconciliationChartSelect,
                    this
                );


                // ========================================================
                // FORCE RENDER
                // ========================================================

                oChart.invalidate();

                oChart.rerender();


                console.log(
                    "===================================="
                );

                console.log(
                    "✅ BAR CHART RENDERED"
                );

                console.log(
                    "===================================="
                );

            },


            // ============================================================
            // CHART SELECTION
            // ============================================================

            onReconciliationChartSelect:
                function (oEvent) {

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
            // DETAIL PRESS
            // ============================================================

            onDetailPress: function (oEvent) {

                var oContext =
                    oEvent
                        .getSource()
                        .getBindingContext(
                            "reconciliation"
                        );

                if (!oContext) {
                    return;
                }

                console.log(
                    "Reconciliation detail:",
                    oContext.getObject()
                );

                MessageToast.show(
                    "Reconciliation detail selected"
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
                            oGroup.details &&
                            oGroup.details.length
                        ) {

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

                    }
                );


                if (!aRows.length) {

                    MessageToast.show(
                        "No reconciliation data to export"
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

                        columns: aColumns

                    },

                    dataSource: aRows,

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