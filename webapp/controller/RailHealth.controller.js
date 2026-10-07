sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator
) {

    "use strict";

    return Controller.extend("payment.dashboard.controller.RailHealth", {

        // ============================================================
        // INITIALIZATION
        // ============================================================

        onInit: function () {

            var oRailHealthModel = new JSONModel({

                allRailsSelected: false,

                // ====================================================
                // GLOBAL FILTER
                // ====================================================

                globalFilter: {
                    clearingArea: "",
                    date: "",
                    createdOn: ""
                },

                // ====================================================
                // AVAILABLE CHANNELS
                // ====================================================

                availableRails: [
                    {
                        key: "All",
                        text: "All"
                    }
                ],

                // ====================================================
                // KPI DATA
                // ====================================================

                kpis: {

                    overallHealth: "0%",
                    overallHealthSub: "No data for this filter",

                    activeRails: "0 / 0",
                    activeRailsSub: "No data for this filter",

                    transactions: "0",
                    transactionsSub: "No data for this filter",

                    successRate: "0%",
                    successRateSub: "No data for this filter",

                    failedPayments: "0%",
                    failedPaymentsSub: "No data for this filter",

                    responseTime: "0 ms",
                    responseTimeSub: "No data for this filter",

                    queueDepth: "0",
                    queueDepthSub: "No data for this filter",

                    alerts: "0",
                    alertsSub: "No data for this filter"
                },

                // ====================================================
                // RAIL OVERVIEW
                // ====================================================

                railOverview: [],

                filteredRailOverview: [],

                // ====================================================
                // TABLE FILTERS
                // ====================================================

                railFilters: {
                    rail: "All",
                    status: "All"
                },

                // ====================================================
                // SELECTED RAIL / CHANNEL
                // ====================================================

                selectedRail: {
                    channel: "",
                    medium: "",
                    status: "",
                    successRate: "",
                    responseTime: "",
                    queueDepth: ""
                },

                // ====================================================
                // DETAILS
                // ====================================================

                railDetailsDirection: "Incoming",

                railDetails: []
            });

            this.getView().setModel(
                oRailHealthModel,
                "railHealth"
            );
        },


        // ============================================================
        // AFTER RENDERING
        // ============================================================

        onAfterRendering: function () {

            if (this._bInitialLoadDone) {
                return;
            }

            var oFilterModel =
                this.getView().getModel("filterModel");

            if (!oFilterModel) {

                console.warn(
                    "Rail Health: filterModel still not found at onAfterRendering"
                );

                return;
            }

            this._bInitialLoadDone = true;

            console.log(
                "Rail Health: initial load via onAfterRendering"
            );

            this.onFilterChange();
        },


        // ============================================================
        // MAIN DASHBOARD FILTER CHANGE
        // ============================================================

        onFilterChange: function () {

            var oFilterModel =
                this.getView().getModel("filterModel");

            if (!oFilterModel) {

                console.warn(
                    "Rail Health: filterModel not found"
                );

                return;
            }

            var sClearingArea =
                oFilterModel.getProperty("/clearingArea");

            var sPostingDate =
                oFilterModel.getProperty("/kpiDate");

            var sCreatedOn =
                oFilterModel.getProperty("/createdOn");


            // ========================================================
            // NORMALIZE POSTING DATE
            // ========================================================

            if (sPostingDate instanceof Date) {

                sPostingDate =
                    sPostingDate.getFullYear() +
                    "-" +
                    String(
                        sPostingDate.getMonth() + 1
                    ).padStart(2, "0") +
                    "-" +
                    String(
                        sPostingDate.getDate()
                    ).padStart(2, "0");

            } else if (sPostingDate) {

                sPostingDate =
                    String(sPostingDate).slice(0, 10);
            }


            // ========================================================
            // NORMALIZE CREATED ON
            // ========================================================

            if (sCreatedOn instanceof Date) {

                sCreatedOn =
                    sCreatedOn.getFullYear() +
                    "-" +
                    String(
                        sCreatedOn.getMonth() + 1
                    ).padStart(2, "0") +
                    "-" +
                    String(
                        sCreatedOn.getDate()
                    ).padStart(2, "0");

            } else if (sCreatedOn) {

                sCreatedOn =
                    String(sCreatedOn).slice(0, 10);
            }


            console.log(
                "======================================"
            );

            console.log(
                "Rail Health global filter:",
                {
                    clearingArea: sClearingArea,
                    postingDate: sPostingDate,
                    createdOn: sCreatedOn
                }
            );

            console.log(
                "======================================"
            );


            var oRailModel =
                this.getView().getModel("railHealth");

            if (oRailModel) {

                oRailModel.setProperty(
                    "/globalFilter/clearingArea",
                    sClearingArea
                );

                oRailModel.setProperty(
                    "/globalFilter/date",
                    sPostingDate
                );

                oRailModel.setProperty(
                    "/globalFilter/createdOn",
                    sCreatedOn
                );
            }


            this._loadRailHealthKpis(
                sClearingArea,
                sPostingDate,
                sCreatedOn
            );
        },


        // ============================================================
        // LOAD RAIL HEALTH KPI DATA
        //
        // OData Entity:
        // /RailHealthKpi
        //
        // One row per PaymentRail / Medium / ioFormat combination.
        // ============================================================

        _loadRailHealthKpis: function (
            sClearingArea,
            sPostingDate,
            sCreatedOn
        ) {

            var oRailModel =
                this.getView().getModel("railHealth");

            if (!oRailModel) {

                console.error(
                    "Rail Health: railHealth model missing"
                );

                return;
            }

            if (!sClearingArea) {

                console.warn(
                    "Rail Health: Clearing Area missing"
                );

                this._setEmptyRailKpis();

                return;
            }


            // ========================================================
            // NORMALIZE DATE
            // ========================================================

            var fnNormalizeDate = function (vDate) {

                if (!vDate) {
                    return "";
                }

                if (vDate instanceof Date) {

                    return (
                        vDate.getFullYear() +
                        "-" +
                        String(
                            vDate.getMonth() + 1
                        ).padStart(2, "0") +
                        "-" +
                        String(
                            vDate.getDate()
                        ).padStart(2, "0")
                    );
                }

                return String(vDate).substring(0, 10);
            };


            sPostingDate =
                fnNormalizeDate(sPostingDate);

            sCreatedOn =
                fnNormalizeDate(sCreatedOn);


            console.log(
                "======================================"
            );

            console.log(
                "RAIL HEALTH FILTER"
            );

            console.log(
                "Clearing Area :",
                sClearingArea
            );

            console.log(
                "Posting Date  :",
                sPostingDate
            );

            console.log(
                "Created On    :",
                sCreatedOn
            );

            console.log(
                "======================================"
            );


            // ========================================================
            // SERVICE URL
            // ========================================================

            var sServiceUrl =
                "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/";

            var sEntityUrl =
                sServiceUrl + "RailHealthKpi";


            // ========================================================
            // BUILD ODATA FILTER
            // ========================================================

            var aUrlFilters = [];

            if (sClearingArea) {

                aUrlFilters.push(
                    "ClearingArea eq '" +
                    String(sClearingArea)
                        .replace(/'/g, "''") +
                    "'"
                );
            }

            if (sCreatedOn) {

                aUrlFilters.push(
                    "CreatedOn eq " +
                    sCreatedOn
                );
            }


            var sUrl = sEntityUrl;

            if (aUrlFilters.length) {

                sUrl +=
                    "?$filter=" +
                    encodeURIComponent(
                        aUrlFilters.join(" and ")
                    );
            }


            console.log(
                "Rail Health OData URL:",
                sUrl
            );


            // ========================================================
            // READ ALL ODATA PAGES
            // ========================================================

            var fnReadPage = function (
                sPageUrl,
                aAllRows
            ) {

                return fetch(sPageUrl, {

                    method: "GET",

                    headers: {
                        "Accept": "application/json"
                    }
                })

                    .then(function (oResponse) {

                        if (!oResponse.ok) {

                            throw new Error(
                                "HTTP " +
                                oResponse.status +
                                " while loading RailHealthKpi"
                            );
                        }

                        return oResponse.json();
                    })

                    .then(function (oPayload) {

                        var aRows =
                            oPayload &&
                            Array.isArray(oPayload.value)
                                ? oPayload.value
                                : [];

                        console.log(
                            "Rail Health: page rows:",
                            aRows.length
                        );

                        aAllRows.push.apply(
                            aAllRows,
                            aRows
                        );


                        var sNextLink =
                            oPayload["@odata.nextLink"];


                        if (sNextLink) {

                            console.log(
                                "Rail Health: loading next OData page"
                            );

                            return fnReadPage(
                                sNextLink,
                                aAllRows
                            );
                        }

                        return aAllRows;
                    });
            };


            // ========================================================
            // LOAD DATA
            // ========================================================

            fnReadPage(sUrl, [])

                .then(function (aData) {

                    console.log(
                        "======================================"
                    );

                    console.log(
                        "Rail Health: TOTAL rows loaded:",
                        aData.length
                    );

                    console.log(
                        "Rail Health: first rows:",
                        aData.slice(0, 5)
                    );

                    console.log(
                        "======================================"
                    );


                    // ====================================================
                    // SAFETY FILTER — CLEARING AREA
                    // ====================================================

                    var aMatchingRecords =
                        aData.filter(function (oItem) {

                            return String(
                                oItem.ClearingArea || ""
                            ) === String(
                                sClearingArea
                            );
                        });


                    // ====================================================
                    // SAFETY FILTER — CREATED ON
                    // ====================================================

                    if (sCreatedOn) {

                        aMatchingRecords =
                            aMatchingRecords.filter(
                                function (oItem) {

                                    return (
                                        fnNormalizeDate(
                                            oItem.CreatedOn
                                        ) === sCreatedOn
                                    );
                                }
                            );
                    }


                    console.log(
                        "Rail Health: records after filters:",
                        aMatchingRecords.length
                    );


                    if (aMatchingRecords.length) {

                        console.log(
                            "Rail Health: matching records:",
                            aMatchingRecords
                        );

                    } else {

                        console.warn(
                            "Rail Health: NO matching records",
                            {
                                clearingArea: sClearingArea,
                                postingDate: sPostingDate,
                                createdOn: sCreatedOn
                            }
                        );
                    }


                    // ====================================================
                    // NO DATA
                    // ====================================================

                    if (!aMatchingRecords.length) {

                        this._setEmptyRailKpis();

                        return;
                    }


                    // ====================================================
                    // UPDATE KPI + TABLE
                    // ====================================================

                    this._updateRailKpis(
                        aMatchingRecords
                    );

                }.bind(this))

                .catch(function (oError) {

                    console.error(
                        "Rail Health RailHealthKpi load failed:",
                        oError
                    );

                    this._setEmptyRailKpis();

                }.bind(this));
        },


        // ============================================================
        // UPDATE KPI TILES + TABLE
        // ============================================================

        _updateRailKpis: function (aRecords) {

            var oModel =
                this.getView().getModel("railHealth");

            if (
                !oModel ||
                !aRecords ||
                !aRecords.length
            ) {
                return;
            }


            // ========================================================
            // AGGREGATE KPI VALUES
            // ========================================================

            var iTotalTransactions = 0;
            var iTotalCriticalAlerts = 0;

            var fResponseTimeWeighted = 0;
            var fSuccessRateWeighted = 0;
            var fFailedRateWeighted = 0;
            var fQueueDepthWeighted = 0;
            var fOverallHealthWeighted = 0;

            var aDistinctRails = [];


            aRecords.forEach(function (oItem) {

                var iTx =
                    Number(oItem.Transactions || 0);

                iTotalTransactions += iTx;

                iTotalCriticalAlerts +=
                    Number(
                        oItem.CriticalAlerts || 0
                    );

                fResponseTimeWeighted +=
                    Number(
                        oItem.ResponseTime || 0
                    ) * iTx;

                fSuccessRateWeighted +=
                    Number(
                        oItem.SuccessRate || 0
                    ) * iTx;

                fFailedRateWeighted +=
                    Number(
                        oItem.FailedRate || 0
                    ) * iTx;

                fQueueDepthWeighted +=
                    Number(
                        oItem.QueueDepth || 0
                    ) * iTx;

                fOverallHealthWeighted +=
                    Number(
                        oItem.OverallHealth || 0
                    ) * iTx;


                var sRail =
                    oItem.PaymentRail || "";

                if (
                    sRail &&
                    aDistinctRails.indexOf(sRail) === -1
                ) {
                    aDistinctRails.push(sRail);
                }
            });


            var fResponseTime =
                iTotalTransactions > 0
                    ? fResponseTimeWeighted /
                      iTotalTransactions
                    : 0;

            var fSuccessRate =
                iTotalTransactions > 0
                    ? fSuccessRateWeighted /
                      iTotalTransactions
                    : 0;

            var fFailedRate =
                iTotalTransactions > 0
                    ? fFailedRateWeighted /
                      iTotalTransactions
                    : 0;

            var fQueueDepth =
                iTotalTransactions > 0
                    ? fQueueDepthWeighted /
                      iTotalTransactions
                    : 0;

            var fOverallHealth =
                iTotalTransactions > 0
                    ? fOverallHealthWeighted /
                      iTotalTransactions
                    : 0;


            var iActiveRailCount =
                aDistinctRails.length;

            var iTotalRailCount =
                Number(
                    aRecords[0].TotalRailCount || 0
                );


            // ========================================================
            // KPI TILES
            // ========================================================

            oModel.setProperty(
                "/kpis/transactions",
                this._formatNumber(
                    iTotalTransactions
                )
            );

            oModel.setProperty(
                "/kpis/transactionsSub",
                "Total transactions"
            );


            oModel.setProperty(
                "/kpis/successRate",
                this._formatPercent(
                    fSuccessRate
                )
            );

            oModel.setProperty(
                "/kpis/successRateSub",
                "Across selected payment rail"
            );


            oModel.setProperty(
                "/kpis/failedPayments",
                this._formatPercent(
                    fFailedRate
                )
            );

            oModel.setProperty(
                "/kpis/failedPaymentsSub",
                "Of total transactions"
            );


            oModel.setProperty(
                "/kpis/responseTime",
                this._formatResponseTime(
                    fResponseTime
                )
            );

            oModel.setProperty(
                "/kpis/responseTimeSub",
                "Average response time"
            );


            oModel.setProperty(
                "/kpis/queueDepth",
                Number(fQueueDepth).toFixed(3)
            );

            oModel.setProperty(
                "/kpis/queueDepthSub",
                "Transactions in queue"
            );


            oModel.setProperty(
                "/kpis/alerts",
                String(iTotalCriticalAlerts)
            );

            oModel.setProperty(
                "/kpis/alertsSub",
                iTotalCriticalAlerts > 0
                    ? "Require attention"
                    : "No critical alerts"
            );


            oModel.setProperty(
                "/kpis/overallHealth",
                this._formatPercent(
                    fOverallHealth
                )
            );

            oModel.setProperty(
                "/kpis/overallHealthSub",
                "From RailHealthKpi"
            );


            oModel.setProperty(
                "/kpis/activeRails",
                iActiveRailCount +
                " / " +
                iTotalRailCount
            );

            oModel.setProperty(
                "/kpis/activeRailsSub",
                "Active for selected filter"
            );


            // ========================================================
            // TABLE
            //
            // DIRECTLY FROM ODATA
            //
            // PaymentRail  -> channel
            // Medium       -> medium
            // HealthStatus -> status
            // SuccessRate  -> successRate
            // ResponseTime -> responseTime
            // QueueDepth   -> queueDepth
            // ========================================================

            var aRailRows =
                aRecords.map(function (oItem) {

                    return {

                        // --------------------------------------------
                        // CHANNEL
                        // OData: PaymentRail
                        // --------------------------------------------

                        channel:
                            oItem.PaymentRail
                                ? String(
                                    oItem.PaymentRail
                                ).replace(/^\/+/, "")
                                : "",


                        // --------------------------------------------
                        // MEDIUM
                        // OData: Medium
                        // --------------------------------------------

                        medium:
                            oItem.Medium
                                ? String(
                                    oItem.Medium
                                ).replace(/^\/+/, "")
                                : "",


                        // --------------------------------------------
                        // STATUS
                        // OData: HealthStatus
                        // --------------------------------------------

                        status:
                            oItem.HealthStatus || "",


                        // --------------------------------------------
                        // SUCCESS RATE
                        // OData: SuccessRate
                        // --------------------------------------------

                        successRate:
                            this._formatPercent(
                                Number(
                                    oItem.SuccessRate || 0
                                )
                            ),


                        // --------------------------------------------
                        // AVG RESPONSE
                        // OData: ResponseTime
                        // --------------------------------------------

                        responseTime:
                            this._formatResponseTime(
                                Number(
                                    oItem.ResponseTime || 0
                                )
                            ),


                        // --------------------------------------------
                        // QUEUE DEPTH
                        // OData: QueueDepth
                        // --------------------------------------------

                        queueDepth:
                            Number(
                                oItem.QueueDepth || 0
                            ).toFixed(2),


                        // --------------------------------------------
                        // KEEP ORIGINAL ODATA ROW
                        //
                        // This will be useful when we implement
                        // row-click details.
                        // --------------------------------------------

                        oData:
                            oItem,

                        selected: false
                    };

                }.bind(this));


            console.log(
                "======================================"
            );

            console.log(
                "RAIL TABLE ROWS CREATED:",
                aRailRows
            );

            console.log(
                "======================================"
            );


            oModel.setProperty(
                "/railOverview",
                aRailRows
            );

            oModel.setProperty(
                "/filteredRailOverview",
                aRailRows
            );

            oModel.setProperty(
                "/allRailsSelected",
                false
            );


            // ========================================================
            // CHANNEL FILTER DROPDOWN
            // ========================================================

            var aAvailableRails = [
                {
                    key: "All",
                    text: "All"
                }
            ].concat(

                aRailRows

                    .map(function (oRow) {
                        return oRow.channel;
                    })

                    .filter(function (
                        sChannel,
                        iIndex,
                        aArray
                    ) {

                        return (
                            sChannel &&
                            aArray.indexOf(
                                sChannel
                            ) === iIndex
                        );
                    })

                    .map(function (sChannel) {

                        return {
                            key: sChannel,
                            text: sChannel
                        };

                    })
            );


            oModel.setProperty(
                "/availableRails",
                aAvailableRails
            );


            oModel.refresh(true);


            console.log(
                "FINAL RAIL TABLE DATA:",
                JSON.stringify(
                    aRailRows
                )
            );


            // ========================================================
            // TABLE DEBUG
            // ========================================================

            setTimeout(function () {

                var oTable =
                    this.byId(
                        "_IDGenRailOverviewTable"
                    );

                if (!oTable) {

                    console.error(
                        "RAIL TABLE NOT FOUND"
                    );

                    return;
                }


                var oBinding =
                    oTable.getBinding("items");


                console.log(
                    "RAIL TABLE ITEMS:",
                    oTable.getItems().length
                );

                console.log(
                    "RAIL TABLE BINDING LENGTH:",
                    oBinding
                        ? oBinding.getLength()
                        : "NO BINDING"
                );

                console.log(
                    "RAIL TABLE MODEL DATA:",
                    oTable.getModel("railHealth")
                        ? oTable
                            .getModel("railHealth")
                            .getProperty(
                                "/filteredRailOverview"
                            )
                        : "NO railHealth MODEL"
                );

            }.bind(this), 500);
        },


        // ============================================================
        // SELECT ALL
        // ============================================================

        onRailSelectAll: function (oEvent) {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var bSelected =
                oEvent.getParameter("selected");

            var aRails =
                oModel.getProperty(
                    "/filteredRailOverview"
                ) || [];


            aRails.forEach(function (oRail) {
                oRail.selected = bSelected;
            });


            oModel.setProperty(
                "/filteredRailOverview",
                aRails
            );

            oModel.setProperty(
                "/allRailsSelected",
                bSelected
            );
        },


        // ============================================================
        // INDIVIDUAL ROW CHECKBOX
        // ============================================================

        onRailRowSelect: function (oEvent) {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var oContext =
                oEvent
                    .getSource()
                    .getBindingContext("railHealth");

            if (!oContext) {
                return;
            }

            var bSelected =
                oEvent.getParameter("selected");


            oContext
                .getModel()
                .setProperty(
                    oContext.getPath() +
                    "/selected",
                    bSelected
                );


            var aRails =
                oModel.getProperty(
                    "/filteredRailOverview"
                ) || [];


            var bAllSelected =
                aRails.length > 0 &&
                aRails.every(function (oRail) {
                    return oRail.selected === true;
                });


            oModel.setProperty(
                "/allRailsSelected",
                bAllSelected
            );
        },


        // ============================================================
        // TABLE FILTER
        // ============================================================

        onRailFilterChange: function () {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }


            var sRail =
                oModel.getProperty(
                    "/railFilters/rail"
                );

            var sStatus =
                oModel.getProperty(
                    "/railFilters/status"
                );


            var aAllRails =
                oModel.getProperty(
                    "/railOverview"
                ) || [];


            var aFilteredRails =
                aAllRails.filter(function (oRail) {

                    // =================================================
                    // IMPORTANT:
                    //
                    // Filter is now against "channel",
                    // which comes directly from PaymentRail.
                    // =================================================

                    var bRailMatch =
                        sRail === "All" ||
                        oRail.channel === sRail;


                    var bStatusMatch =
                        sStatus === "All" ||
                        oRail.status === sStatus;


                    return (
                        bRailMatch &&
                        bStatusMatch
                    );
                });


            oModel.setProperty(
                "/filteredRailOverview",
                aFilteredRails
            );


            oModel.setProperty(
                "/allRailsSelected",
                aFilteredRails.length > 0 &&
                aFilteredRails.every(
                    function (oRail) {
                        return (
                            oRail.selected === true
                        );
                    }
                )
            );
        },


        // ============================================================
        // ROW PRESS
        // ============================================================

        onRailRowPress: function (oEvent) {

            var oContext =
                oEvent
                    .getSource()
                    .getBindingContext("railHealth");

            if (!oContext) {
                return;
            }


            var oSelectedRail =
                oContext.getObject();


            var oModel =
                this.getView().getModel("railHealth");


            // Store complete selected row

            oModel.setProperty(
                "/selectedRail",
                oSelectedRail
            );


            oModel.setProperty(
                "/railDetailsDirection",
                "Incoming"
            );


            console.log(
                "======================================"
            );

            console.log(
                "SELECTED RAIL ROW:",
                oSelectedRail
            );

            console.log(
                "Channel:",
                oSelectedRail.channel
            );

            console.log(
                "Medium:",
                oSelectedRail.medium
            );

            console.log(
                "Status:",
                oSelectedRail.status
            );

            console.log(
                "Success Rate:",
                oSelectedRail.successRate
            );

            console.log(
                "Avg Response:",
                oSelectedRail.responseTime
            );

            console.log(
                "Queue Depth:",
                oSelectedRail.queueDepth
            );

            console.log(
                "======================================"
            );


            // Keep existing detail loading for now.
            // We will redesign this after the table is confirmed.

            this._loadRailDetails(
                oSelectedRail.channel,
                "Incoming"
            );


            var oDialog =
                this.byId(
                    "_IDGenRailDetailsDialog"
                );

            if (oDialog) {
                oDialog.open();
            }
        },


        // ============================================================
        // DETAILS DIRECTION
        // ============================================================

        onRailDetailsDirectionChange: function (oEvent) {

            var sDirection =
                oEvent
                    .getParameter("item")
                    .getKey();


            var oModel =
                this.getView().getModel("railHealth");


            var oSelectedRail =
                oModel.getProperty(
                    "/selectedRail"
                );


            oModel.setProperty(
                "/railDetailsDirection",
                sDirection
            );


            if (
                !oSelectedRail ||
                !oSelectedRail.channel
            ) {
                return;
            }


            this._loadRailDetails(
                oSelectedRail.channel,
                sDirection
            );
        },


        // ============================================================
        // RAIL DETAILS
        //
        // Existing ItemDetails logic is retained for now.
        // We will redesign this after the table is working.
        // ============================================================

        _loadRailDetails: function (
            sRail,
            sDirection
        ) {

            var oModel =
                this.getView().getModel("railHealth");


            if (!oModel) {

                console.error(
                    "Rail Health: railHealth model missing"
                );

                return;
            }


            var oGlobalFilter =
                oModel.getProperty(
                    "/globalFilter"
                ) || {};


            var sClearingArea =
                oGlobalFilter.clearingArea || "";


            // IMPORTANT:
            // Use CreatedOn, not Posting Date.

            var sDate =
                oGlobalFilter.createdOn || "";


            console.log(
                "======================================"
            );

            console.log(
                "RAIL DETAILS"
            );

            console.log(
                "Channel      :",
                sRail
            );

            console.log(
                "Direction    :",
                sDirection
            );

            console.log(
                "ClearingArea :",
                sClearingArea
            );

            console.log(
                "Created On   :",
                sDate
            );

            console.log(
                "======================================"
            );


            // ========================================================
            // SERVICE URL
            // ========================================================

            var sServiceUrl =
                this.getOwnerComponent()
                    .getManifestEntry(
                        "/sap.app/dataSources/mainService/uri"
                    );


            var sEntityUrl =
                sServiceUrl +
                "ItemDetails";


            // ========================================================
            // BUILD FILTERS
            // ========================================================

            var aFilters = [];


            if (sClearingArea) {

                aFilters.push(
                    "ClearingArea eq '" +
                    sClearingArea
                        .replace(/'/g, "''") +
                    "'"
                );
            }


            if (sDate) {

                var sNormalizedDate =
                    String(sDate).substring(
                        0,
                        10
                    );


                aFilters.push(
                    "PaymentOrderDate eq " +
                    sNormalizedDate
                );
            }


            var sUrl =
                sEntityUrl;


            if (aFilters.length > 0) {

                sUrl +=
                    "?$filter=" +
                    encodeURIComponent(
                        aFilters.join(" and ")
                    );
            }


            console.log(
                "Rail details ItemDetails URL:",
                sUrl
            );


            // ========================================================
            // FETCH ITEM DETAILS
            // ========================================================

            fetch(sUrl, {

                method: "GET",

                headers: {
                    "Accept": "application/json"
                },

                credentials: "same-origin"

            })

                .then(function (oResponse) {

                    if (!oResponse.ok) {

                        throw new Error(
                            "HTTP " +
                            oResponse.status +
                            " while loading ItemDetails"
                        );
                    }

                    return oResponse.json();
                })


                .then(function (oPayload) {

                    var aItems =
                        oPayload &&
                        Array.isArray(
                            oPayload.value
                        )
                            ? oPayload.value
                            : [];


                    console.log(
                        "Rail details ItemDetails count:",
                        aItems.length
                    );


                    console.log(
                        "Rail details raw data:",
                        aItems
                    );


                    // ====================================================
                    // FILTER BY RAIL IF FIELD EXISTS
                    // ====================================================

                    var aRailItems =
                        aItems.filter(function (oItem) {

                            var sItemRail =
                                String(
                                    oItem.PaymentRail ||
                                    oItem.Rail ||
                                    oItem.PaymentRailName ||
                                    ""
                                ).trim();


                            if (sItemRail) {

                                return (
                                    sItemRail ===
                                    String(sRail).trim()
                                );
                            }


                            // Keep rows until the actual
                            // rail relationship is confirmed.

                            return true;
                        });


                    console.log(
                        "Rail details after rail filter:",
                        aRailItems.length
                    );


                    // ====================================================
                    // INCOMING / OUTGOING
                    //
                    // 119010 = OUTGOING
                    // Everything else = INCOMING
                    // ====================================================

                    var aFilteredItems =
                        aRailItems.filter(
                            function (oItem) {

                                var sTransactionType =
                                    String(
                                        oItem.TransactionType ||
                                        ""
                                    ).trim();


                                if (
                                    sDirection ===
                                    "Outgoing"
                                ) {

                                    return (
                                        sTransactionType ===
                                        "119010"
                                    );
                                }


                                return (
                                    sTransactionType !==
                                    "119010"
                                );
                            }
                        );


                    console.log(
                        "Rail details direction:",
                        sDirection
                    );


                    console.log(
                        "Rail details final count:",
                        aFilteredItems.length
                    );


                    // ====================================================
                    // MAP TO DIALOG MODEL
                    // ====================================================

                    var aDetails =
                        aFilteredItems.map(
                            function (oItem) {

                                return {

                                    itemNumber:
                                        oItem.ItemNumber ||
                                        "",

                                    itemProcessingStatus:
                                        oItem.ItemProcessingStatus ||
                                        "",

                                    incomingPaymentOrder:
                                        oItem.IncomingPaymentOrder ||
                                        "0",

                                    outgoingPaymentOrder:
                                        oItem.OutgoingPaymentOrder ||
                                        "0",

                                    technicalStatus:
                                        oItem.TechnicalStatus ||
                                        "",

                                    previousTechnicalStatus:
                                        oItem.PreviousTechnicalStatus ||
                                        "",

                                    transactionType:
                                        oItem.TransactionType ||
                                        ""
                                };
                            }
                        );


                    // ====================================================
                    // REMOVE DUPLICATES
                    // ====================================================

                    var oSeen = {};


                    aDetails =
                        aDetails.filter(
                            function (oItem) {

                                var sKey = [
                                    oItem.itemNumber,
                                    oItem.incomingPaymentOrder,
                                    oItem.outgoingPaymentOrder
                                ].join("|");


                                if (oSeen[sKey]) {
                                    return false;
                                }


                                oSeen[sKey] = true;

                                return true;
                            }
                        );


                    // ====================================================
                    // UPDATE MODEL
                    // ====================================================

                    oModel.setProperty(
                        "/railDetails",
                        aDetails
                    );


                    oModel.refresh(true);


                    console.log(
                        "======================================"
                    );

                    console.log(
                        "FINAL RAIL DETAILS:",
                        aDetails
                    );

                    console.log(
                        "FINAL RAIL DETAILS COUNT:",
                        aDetails.length
                    );

                    console.log(
                        "======================================"
                    );

                }.bind(this))


                .catch(function (oError) {

                    console.error(
                        "Rail details ItemDetails load failed:",
                        oError
                    );


                    oModel.setProperty(
                        "/railDetails",
                        []
                    );

                    oModel.refresh(true);

                }.bind(this));
        },


        // ============================================================
        // CLOSE DIALOG
        // ============================================================

        onCloseRailDetails: function () {

            var oDialog =
                this.byId(
                    "_IDGenRailDetailsDialog"
                );

            if (oDialog) {
                oDialog.close();
            }
        },


        // ============================================================
        // EMPTY KPI STATE
        // ============================================================

        _setEmptyRailKpis: function () {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }


            oModel.setProperty(
                "/kpis/overallHealth",
                "0%"
            );

            oModel.setProperty(
                "/kpis/overallHealthSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/activeRails",
                "0 / 0"
            );

            oModel.setProperty(
                "/kpis/activeRailsSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/transactions",
                "0"
            );

            oModel.setProperty(
                "/kpis/transactionsSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/successRate",
                "0%"
            );

            oModel.setProperty(
                "/kpis/successRateSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/failedPayments",
                "0%"
            );

            oModel.setProperty(
                "/kpis/failedPaymentsSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/responseTime",
                "0 ms"
            );

            oModel.setProperty(
                "/kpis/responseTimeSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/queueDepth",
                "0"
            );

            oModel.setProperty(
                "/kpis/queueDepthSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/kpis/alerts",
                "0"
            );

            oModel.setProperty(
                "/kpis/alertsSub",
                "No data for this filter"
            );


            oModel.setProperty(
                "/railOverview",
                []
            );

            oModel.setProperty(
                "/filteredRailOverview",
                []
            );

            oModel.setProperty(
                "/allRailsSelected",
                false
            );


            oModel.setProperty(
                "/availableRails",
                [
                    {
                        key: "All",
                        text: "All"
                    }
                ]
            );
        },


        // ============================================================
        // DATE FORMAT
        // ============================================================

        _formatDateForOData: function (vDate) {

            if (!vDate) {
                return null;
            }


            if (typeof vDate === "string") {

                return vDate.substring(
                    0,
                    10
                );
            }


            if (vDate instanceof Date) {

                var iYear =
                    vDate.getFullYear();

                var iMonth =
                    vDate.getMonth() + 1;

                var iDay =
                    vDate.getDate();


                return (
                    iYear +
                    "-" +
                    String(iMonth).padStart(
                        2,
                        "0"
                    ) +
                    "-" +
                    String(iDay).padStart(
                        2,
                        "0"
                    )
                );
            }


            return null;
        },


        // ============================================================
        // NORMALISE DATE
        // ============================================================

        _normaliseDate: function (vDate) {

            if (!vDate) {
                return null;
            }


            if (vDate instanceof Date) {

                return this._formatDateForOData(
                    vDate
                );
            }


            return String(vDate).substring(
                0,
                10
            );
        },


        // ============================================================
        // ADD ONE DAY
        // ============================================================

        _addOneDay: function (sIsoDate) {

            if (!sIsoDate) {
                return null;
            }


            var oDate =
                new Date(
                    sIsoDate +
                    "T00:00:00"
                );


            oDate.setDate(
                oDate.getDate() + 1
            );


            var iYear =
                oDate.getFullYear();

            var iMonth =
                oDate.getMonth() + 1;

            var iDay =
                oDate.getDate();


            return (
                iYear +
                "-" +
                String(iMonth).padStart(
                    2,
                    "0"
                ) +
                "-" +
                String(iDay).padStart(
                    2,
                    "0"
                )
            );
        },


        // ============================================================
        // PERCENT FORMAT
        // ============================================================

        _formatPercent: function (fValue) {

            return (
                Number(fValue).toFixed(2) +
                "%"
            );
        },


        // ============================================================
        // NUMBER FORMAT
        // ============================================================

        _formatNumber: function (iValue) {

            var fNumber =
                Number(iValue || 0);


            if (fNumber >= 1000000) {

                return (
                    fNumber / 1000000
                ).toFixed(2) + "M";
            }


            if (fNumber >= 1000) {

                return (
                    fNumber / 1000
                ).toFixed(1) + "K";
            }


            return String(fNumber);
        },


        // ============================================================
        // RESPONSE TIME FORMAT
        // ============================================================

        _formatResponseTime: function (fValue) {

            return (
                Number(fValue).toFixed(2) +
                " ms"
            );
        }

    });

});