sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
], function (Controller, JSONModel, MessageToast, Spreadsheet, library) {
    "use strict";

    return Controller.extend("payment.dashboard.controller.Reconciliation", {

        onInit: function () {

            var oModel = new JSONModel({

                filter: {

                    reconDate: "",
                    clearingArea: "DEBNKC",
                    reconciliationType: "ALL",
                    status: "ALL",
                    companyCode: ""

                },

                statusData: [

                    {
                        Status: "Matched",
                        Count: 176
                    },
                    {
                        Status: "Partially Matched",
                        Count: 42
                    },
                    {
                        Status: "Unmatched",
                        Count: 24
                    },
                    {
                        Status: "Open Items",
                        Count: 6
                    }

                ],

                trendData: [

                    { Date: "Jun 01", Status: "Matched", Count: 40 },
                    { Date: "Jun 01", Status: "Partially Matched", Count: 25 },
                    { Date: "Jun 01", Status: "Unmatched", Count: 10 },

                    { Date: "Jun 02", Status: "Matched", Count: 36 },
                    { Date: "Jun 02", Status: "Partially Matched", Count: 20 },
                    { Date: "Jun 02", Status: "Unmatched", Count: 8 },

                    { Date: "Jun 03", Status: "Matched", Count: 50 },
                    { Date: "Jun 03", Status: "Partially Matched", Count: 30 },
                    { Date: "Jun 03", Status: "Unmatched", Count: 15 },

                    { Date: "Jun 04", Status: "Matched", Count: 52 },
                    { Date: "Jun 04", Status: "Partially Matched", Count: 28 },
                    { Date: "Jun 04", Status: "Unmatched", Count: 14 },

                    { Date: "Jun 05", Status: "Matched", Count: 60 },
                    { Date: "Jun 05", Status: "Partially Matched", Count: 35 },
                    { Date: "Jun 05", Status: "Unmatched", Count: 18 }

                ],
                reasonData: [

                    {
                        Reason: "Amount Difference",
                        Count: 12
                    },

                    {
                        Reason: "Missing Bank Reference",
                        Count: 7
                    },

                    {
                        Reason: "Date Difference",
                        Count: 3
                    },

                    {
                        Reason: "Duplicate Entries",
                        Count: 2
                    },

                    {
                        Reason: "Others",
                        Count: 0
                    }

                ]

            });

            this.getView().setModel(oModel, "reconciliation");

            var aRecon = [

                {
                    ReconId: "REC-2026-000248",
                    Date: "Jun 17, 2026",
                    Type: "Statement Reconciliation",
                    Country: "Germany",
                    Status: "Matched",
                    State: "Success",
                    MatchedAmount: "1,250,000.00",
                    UnmatchedAmount: "0.00",
                    OpenItems: 0
                },

                {
                    ReconId: "REC-2026-000247",
                    Date: "Jun 17, 2026",
                    Type: "Payment Reconciliation",
                    Country: "Germany",
                    Status: "Partially Matched",
                    State: "Warning",
                    MatchedAmount: "850,000.00",
                    UnmatchedAmount: "45,000.00",
                    OpenItems: 2
                },

                {
                    ReconId: "REC-2026-000246",
                    Date: "Jun 16, 2026",
                    Type: "Statement Reconciliation",
                    Country: "Germany",
                    Status: "Unmatched",
                    State: "Error",
                    MatchedAmount: "0.00",
                    UnmatchedAmount: "120,000.00",
                    OpenItems: 3
                },

                {
                    ReconId: "REC-2026-000245",
                    Date: "Jun 16, 2026",
                    Type: "Payment Reconciliation",
                    Country: "France",
                    Status: "Matched",
                    State: "Success",
                    MatchedAmount: "650,000.00",
                    UnmatchedAmount: "0.00",
                    OpenItems: 0
                },

                {
                    ReconId: "REC-2026-000244",
                    Date: "Jun 15, 2026",
                    Type: "Statement Reconciliation",
                    Country: "Netherlands",
                    Status: "Partially Matched",
                    State: "Warning",
                    MatchedAmount: "420,000.00",
                    UnmatchedAmount: "18,500.00",
                    OpenItems: 1
                },

                {
                    ReconId: "REC-2026-000244",
                    Date: "Jun 15, 2026",
                    Type: "Statement Reconciliation",
                    Country: "Netherlands",
                    Status: "Partially Matched",
                    State: "Warning",
                    MatchedAmount: "420,000.00",
                    UnmatchedAmount: "18,500.00",
                    OpenItems: 1
                },

                // Add remaining records...
            ];

            oModel.setProperty("/reconciliationList", aRecon);

            oModel.setProperty("/currentPage", 1);
            oModel.setProperty("/totalPages", 1);

            oModel.setProperty("/canPrevious", false);
            oModel.setProperty("/canNext", false);

            this._pageSize = 5;
            this._currentPage = 1;

            this._updatePagination();


            var oReasonChart = this.byId("idReasonChart");

            if (oReasonChart) {

                oReasonChart.setVizProperties({

                    title: {
                        visible: false
                    },

                    legend: {
                        visible: false
                    },

                    plotArea: {

                        colorPalette: [
                            "#FF4D4F"
                        ],

                        dataLabel: {
                            visible: true
                        }

                    },

                    valueAxis: {

                        title: {
                            visible: false
                        }

                    },

                    categoryAxis: {

                        title: {
                            visible: false
                        }

                    }

                });

            }

            var oTrendChart = this.byId("idReconTrendChart");

            if (oTrendChart) {

                oTrendChart.setVizProperties({

                    title: {
                        visible: false
                    },

                    legend: {
                        visible: true
                    },

                    plotArea: {

                        colorPalette: [
                            "#34C759",
                            "#FFB020",
                            "#FF4D4F"
                        ],

                        dataLabel: {
                            visible: false
                        }

                    },

                    valueAxis: {
                        title: {
                            visible: false
                        }
                    },

                    categoryAxis: {
                        title: {
                            visible: false
                        }
                    }

                });

            }

        },



        onAfterRendering: function () {

            var oChart = this.byId("idReconDonutChart");

            if (!oChart) {
                return;
            }

            oChart.setVizProperties({

                title: {
                    visible: false
                },

                legend: {
                    visible: false
                },

                plotArea: {

                    colorPalette: [

                        "#34C759",
                        "#FFB020",
                        "#FF4D4F",
                        "#8E5AD7"

                    ],

                    dataLabel: {
                        visible: true,
                        type: "percentage"
                    }

                }

            });

        },



        onSearch: function () {



        },

        onReconDonutSelect: function (oEvent) {

            var aData = oEvent.getParameter("data");

            if (!aData || !aData.length) {
                return;
            }

            var oObject = aData[0].data;

            console.log("Selected:", oObject);



        },
        onReconDonutExpand: function () {

            this.openReconChart(
                "Reconciliation Status Breakdown",
                "donut",
                this.byId("idReconDonutChart").getDataset(),
                this.byId("idReconDonutChart").getFeeds(),
                this.byId("idReconDonutChart").getVizProperties()
            );

        },

        onReconTrendExpand: function () {

            this.openReconChart(
                "Reconciliation Trend",
                "line",
                this.byId("idReconTrendChart").getDataset(),
                this.byId("idReconTrendChart").getFeeds(),
                this.byId("idReconTrendChart").getVizProperties()
            );

        },

        onReasonChartExpand: function () {

            this.openReconChart(
                "Top 5 Reasons for Unmatched Items",
                "bar",
                this.byId("idReasonChart").getDataset(),
                this.byId("idReasonChart").getFeeds(),
                this.byId("idReasonChart").getVizProperties()
            );

        },

        onCloseReconDialog: function () {

            this.byId("reconChartDialog").close();

        },

        openReconChart: function (sTitle, sVizType, oDataset, aFeeds, oVizProps) {

            var oDialog = this.byId("reconChartDialog");
            var oChart = this.byId("idReconExpandedChart");

            oDialog.setTitle(sTitle);

            oChart.setVizType(sVizType);
            oChart.setDataset(oDataset);

            oChart.removeAllFeeds();

            aFeeds.forEach(function (oFeed) {
                oChart.addFeed(oFeed);
            });

            oChart.setVizProperties(oVizProps);

            oDialog.open();
        },

        _updatePagination: function () {

            var oModel = this.getView().getModel("reconciliation");

            var aData = oModel.getProperty("/reconciliationList");

            var iTotalPages = Math.max(
                1,
                Math.ceil(aData.length / this._pageSize)
            );

            var iStart = (this._currentPage - 1) * this._pageSize;

            var iEnd = iStart + this._pageSize;

            oModel.setProperty("/pagedData", aData.slice(iStart, iEnd));

            oModel.setProperty("/currentPage", this._currentPage);

            oModel.setProperty("/totalPages", iTotalPages);

            oModel.setProperty("/canPrevious", this._currentPage > 1);

            oModel.setProperty("/canNext", this._currentPage < iTotalPages);

        },

        onNextPage: function () {

            var oModel = this.getView().getModel("reconciliation");

            var total = Math.ceil(
                oModel.getProperty("/reconciliationList").length /
                this._pageSize
            );

            if (this._currentPage < total) {

                this._currentPage++;

                this._updatePagination();

            }

        },

        onPreviousPage: function () {

            if (this._currentPage > 1) {

                this._currentPage--;

                this._updatePagination();

            }

        },

        onReconSearch: function (oEvent) {

            var sValue = oEvent.getParameter("newValue").toLowerCase();

            var oModel = this.getView().getModel("reconciliation");

            var aAll = oModel.getProperty("/reconciliationList");

            var aFiltered = aAll.filter(function (oItem) {

                return (
                    oItem.ReconId.toLowerCase().includes(sValue) ||
                    oItem.Country.toLowerCase().includes(sValue) ||
                    oItem.Type.toLowerCase().includes(sValue)
                );

            });

            oModel.setProperty("/pagedData", aFiltered.slice(0, 5));

            this._currentPage = 1;

            oModel.setProperty("/totalPages",
                Math.ceil(aFiltered.length / 5));

        },

        onExportExcel: function () {

            var Spreadsheet = sap.ui.require("sap/ui/export/Spreadsheet");

            var oModel = this.getView().getModel("reconciliation");

            var oSheet = new Spreadsheet({

                workbook: {

                    columns: [

                        { label: "Recon ID", property: "ReconId" },
                        { label: "Date", property: "Date" },
                        { label: "Type", property: "Type" },
                        { label: "Country", property: "Country" },
                        { label: "Status", property: "Status" },
                        { label: "Matched", property: "MatchedAmount" },
                        { label: "Unmatched", property: "UnmatchedAmount" },
                        { label: "Open Items", property: "OpenItems" }

                    ]

                },

                dataSource: oModel.getProperty("/reconciliationList"),

                fileName: "Reconciliation_List.xlsx"

            });

            oSheet.build();

        },

        onOpenSettings: function () {

            sap.m.MessageToast.show("Open Table Personalization");

        },

    });

});