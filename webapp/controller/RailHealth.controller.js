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
                    date: ""
                },

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
                // SELECTED RAIL
                // ====================================================

                selectedRail: {
                    rail: "",
                    status: "",
                    successRate: "",
                    responseTime: "",
                    volume: ""
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

            var sDate =
                oFilterModel.getProperty("/kpiDate");

            console.log(
                "Rail Health global filter:",
                {
                    clearingArea: sClearingArea,
                    date: sDate
                }
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
                    sDate
                );
            }

            // ========================================================
            // ONE ODATA CALL FOR ALL KPI TILES
            // ========================================================

            this._loadRailHealthKpis(
                sClearingArea,
                sDate
            );
        },


        // ============================================================
        // LOAD ALL KPI DATA
        //
        // OData Entity:
        // /RailHealthKpi
        //
        // Fields used:
        // ClearingArea
        // CreatedOn
        // ActiveRailPercentage
        // SuccessRate
        // FailedRate
        // QueueDepth
        // CriticalAlertRate
        // ActiveRailCount
        // TotalRailCount
        // Transactions
        // ResponseTime
        // CriticalAlerts
        // OverallHealth
        // ============================================================

        _loadRailHealthKpis: function (
            sClearingArea,
            sDate
        ) {

            var oODataModel =
                this.getOwnerComponent().getModel("odataModel");

            var oRailModel =
                this.getView().getModel("railHealth");

            if (!oODataModel || !oRailModel) {

                console.error(
                    "Rail Health: OData model or Rail Health model missing"
                );

                return;
            }

            if (!sClearingArea || !sDate) {

                console.warn(
                    "Rail Health: missing filter values"
                );

                this._setEmptyRailKpis();

                return;
            }

            var sFormattedDate =
                this._formatDateForOData(sDate);

            var sNextDay =
                this._addOneDay(sFormattedDate);

            console.log(
                "Rail Health: loading RailHealthKpi",
                {
                    clearingArea: sClearingArea,
                    date: sFormattedDate
                }
            );

            // ========================================================
            // ODATA FILTER
            // ========================================================

            var aFilters = [

                new Filter(
                    "ClearingArea",
                    FilterOperator.EQ,
                    sClearingArea
                ),

                new Filter({

                    filters: [

                        new Filter(
                            "CreatedOn",
                            FilterOperator.GE,
                            sFormattedDate
                        ),

                        new Filter(
                            "CreatedOn",
                            FilterOperator.LT,
                            sNextDay
                        )

                    ],

                    and: true
                })
            ];

            // ========================================================
            // SINGLE ODATA ENTITY
            // ========================================================

            var oListBinding =
                oODataModel.bindList(
                    "/RailHealthKpi",
                    null,
                    null,
                    aFilters
                );

            oListBinding
                .requestContexts(0, 1000)

                .then(function (aContexts) {

                    var aData =
                        aContexts.map(function (oContext) {

                            return oContext.getObject();

                        });

                    console.log(
                        "Rail Health: RailHealthKpi records:",
                        aData
                    );

                    // =================================================
                    // NO DATA
                    // =================================================

                    if (!aData.length) {

                        console.warn(
                            "Rail Health: No RailHealthKpi data found for:",
                            sClearingArea,
                            sFormattedDate
                        );

                        this._setEmptyRailKpis();

                        return;
                    }

                    // =================================================
                    // FIND EXACT RECORD
                    // =================================================

                    var oData =
                        aData.find(function (oItem) {

                            return (

                                String(
                                    oItem.ClearingArea
                                ) === String(
                                    sClearingArea
                                )

                                &&

                                this._normaliseDate(
                                    oItem.CreatedOn
                                ) === sFormattedDate

                            );

                        }.bind(this));

                    // =================================================
                    // FALLBACK
                    // =================================================

                    if (!oData) {

                        console.warn(
                            "Rail Health: exact date not found, using first record"
                        );

                        oData = aData[0];
                    }

                    console.log(
                        "Rail Health: selected KPI record:",
                        oData
                    );

                    // =================================================
                    // UPDATE EVERYTHING FROM SAME ODATA RECORD
                    // =================================================

                    this._updateRailKpis(oData);

                }.bind(this))

                .catch(function (oError) {

                    console.error(
                        "Rail Health RailHealthKpi load failed:",
                        oError &&
                        (
                            oError.message ||
                            oError
                        )
                    );

                    this._setEmptyRailKpis();

                }.bind(this));
        },


        // ============================================================
        // UPDATE ALL KPI TILES
        // ============================================================

        _updateRailKpis: function (oItem) {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel || !oItem) {
                return;
            }

            // ========================================================
            // READ ODATA VALUES
            // ========================================================

            var iTransactions =
                Number(
                    oItem.Transactions || 0
                );

            var fResponseTime =
                Number(
                    oItem.ResponseTime || 0
                );

            var iCriticalAlerts =
                Number(
                    oItem.CriticalAlerts || 0
                );

            var fSuccessRate =
                Number(
                    oItem.SuccessRate || 0
                );

            var fFailedRate =
                Number(
                    oItem.FailedRate || 0
                );

            var fQueueDepth =
                Number(
                    oItem.QueueDepth || 0
                );

            var fOverallHealth =
                Number(
                    oItem.OverallHealth || 0
                );

            var iActiveRailCount =
                Number(
                    oItem.ActiveRailCount || 0
                );

            var iTotalRailCount =
                Number(
                    oItem.TotalRailCount || 0
                );

            // ========================================================
            // STATUS
            //
            // Based on OverallHealth, which now comes straight from
            // RailHealthKpi instead of being derived from FailedRate.
            // ========================================================

            var sStatus = "Healthy";

            if (fOverallHealth < 20) {

                sStatus = "Critical";

            } else if (fOverallHealth < 35) {

                sStatus = "Warning";
            }

            // ========================================================
            // ACTIVE RAILS
            // ========================================================

            var sActiveRails =
                iActiveRailCount +
                " / " +
                iTotalRailCount;

            // ========================================================
            // TRANSACTIONS
            // ========================================================

            oModel.setProperty(
                "/kpis/transactions",
                this._formatNumber(
                    iTransactions
                )
            );

            oModel.setProperty(
                "/kpis/transactionsSub",
                "Total transactions"
            );

            // ========================================================
            // SUCCESS RATE
            // ========================================================

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

            // ========================================================
            // FAILED PAYMENTS
            // ========================================================

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

            // ========================================================
            // RESPONSE TIME
            // ========================================================

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

            // ========================================================
            // QUEUE DEPTH
            // ========================================================

            oModel.setProperty(
                "/kpis/queueDepth",
                this._formatNumber(
                    fQueueDepth
                )
            );

            oModel.setProperty(
                "/kpis/queueDepthSub",
                "Transactions in queue"
            );

            // ========================================================
            // CRITICAL ALERTS
            // ========================================================

            oModel.setProperty(
                "/kpis/alerts",
                String(
                    iCriticalAlerts
                )
            );

            oModel.setProperty(
                "/kpis/alertsSub",

                iCriticalAlerts > 0
                    ? "Require attention"
                    : "No critical alerts"
            );

            // ========================================================
            // OVERALL HEALTH
            // ========================================================

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

            // ========================================================
            // ACTIVE RAILS
            // ========================================================

            oModel.setProperty(
                "/kpis/activeRails",
                sActiveRails
            );

            oModel.setProperty(
                "/kpis/activeRailsSub",
                "Active for selected filter"
            );

            // ========================================================
            // RAIL TABLE
            // ========================================================

            var oRailRow = {

                rail:
                    oItem.ClearingArea,

                status:
                    sStatus,

                successRate:
                    this._formatPercent(
                        fSuccessRate
                    ),

                responseTime:
                    this._formatResponseTime(
                        fResponseTime
                    ),

                volume:
                    this._formatNumber(
                        iTransactions
                    ),

                selected: false
            };

            console.log(
                "RAIL TABLE ROW CREATED:",
                oRailRow
            );

            var aRailRows = [
                oRailRow
            ];

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
                    oTable.getBinding(
                        "items"
                    );

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
                    oTable
                        .getModel("railHealth")
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
                this.getView().getModel(
                    "railHealth"
                );

            if (!oModel) {
                return;
            }

            var bSelected =
                oEvent.getParameter(
                    "selected"
                );

            var aRails =
                oModel.getProperty(
                    "/filteredRailOverview"
                ) || [];

            aRails.forEach(function (oRail) {

                oRail.selected =
                    bSelected;

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
                this.getView().getModel(
                    "railHealth"
                );

            if (!oModel) {
                return;
            }

            var oContext =
                oEvent
                    .getSource()
                    .getBindingContext(
                        "railHealth"
                    );

            if (!oContext) {
                return;
            }

            var bSelected =
                oEvent.getParameter(
                    "selected"
                );

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
                aRails.every(
                    function (oRail) {

                        return (
                            oRail.selected === true
                        );

                    }
                );

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
                this.getView().getModel(
                    "railHealth"
                );

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
                aAllRails.filter(
                    function (oRail) {

                        var bRailMatch =
                            sRail === "All" ||
                            oRail.rail === sRail;

                        var bStatusMatch =
                            sStatus === "All" ||
                            oRail.status === sStatus;

                        return (
                            bRailMatch &&
                            bStatusMatch
                        );
                    }
                );

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
                    .getBindingContext(
                        "railHealth"
                    );

            if (!oContext) {
                return;
            }

            var oSelectedRail =
                oContext.getObject();

            var oModel =
                this.getView().getModel(
                    "railHealth"
                );

            oModel.setProperty(
                "/selectedRail",
                oSelectedRail
            );

            oModel.setProperty(
                "/railDetailsDirection",
                "Incoming"
            );

            this._loadRailDetails(
                oSelectedRail.rail,
                "Incoming"
            );

            this.byId(
                "_IDGenRailDetailsDialog"
            ).open();
        },


        // ============================================================
        // DETAILS DIRECTION
        // ============================================================

        onRailDetailsDirectionChange:
            function (oEvent) {

                var sDirection =
                    oEvent
                        .getParameter(
                            "item"
                        )
                        .getKey();

                var oModel =
                    this.getView().getModel(
                        "railHealth"
                    );

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
                    !oSelectedRail.rail
                ) {
                    return;
                }

                this._loadRailDetails(
                    oSelectedRail.rail,
                    sDirection
                );
            },


        // ============================================================
        // RAIL DETAILS
        //
        // No detail OData entity was supplied.
        // Keep this method for the dialog.
        // ============================================================

        _loadRailDetails: function (
            sRail,
            sDirection
        ) {

            var oModel =
                this.getView().getModel(
                    "railHealth"
                );

            if (!oModel) {
                return;
            }

            console.log(
                "Loading rail details:",
                sRail,
                sDirection
            );

            var aIncomingDetails = [

                {
                    date: "29-Sep-2026",
                    status: "Healthy",
                    successRate: "99.98%",
                    responseTime: "2.1 sec",
                    volume: "120K"
                },

                {
                    date: "28-Sep-2026",
                    status: "Healthy",
                    successRate: "99.95%",
                    responseTime: "2.4 sec",
                    volume: "105K"
                },

                {
                    date: "27-Sep-2026",
                    status: "Healthy",
                    successRate: "99.97%",
                    responseTime: "2.2 sec",
                    volume: "98K"
                },

                {
                    date: "26-Sep-2026",
                    status: "Warning",
                    successRate: "98.91%",
                    responseTime: "3.8 sec",
                    volume: "87K"
                }
            ];

            var aOutgoingDetails = [

                {
                    date: "29-Sep-2026",
                    status: "Healthy",
                    successRate: "99.94%",
                    responseTime: "2.3 sec",
                    volume: "115K"
                },

                {
                    date: "28-Sep-2026",
                    status: "Healthy",
                    successRate: "99.92%",
                    responseTime: "2.5 sec",
                    volume: "101K"
                },

                {
                    date: "27-Sep-2026",
                    status: "Healthy",
                    successRate: "99.96%",
                    responseTime: "2.1 sec",
                    volume: "96K"
                },

                {
                    date: "26-Sep-2026",
                    status: "Warning",
                    successRate: "98.88%",
                    responseTime: "3.6 sec",
                    volume: "82K"
                }
            ];

            var aDetails =
                sDirection === "Outgoing"
                    ? aOutgoingDetails
                    : aIncomingDetails;

            oModel.setProperty(
                "/railDetails",
                aDetails
            );
        },


        // ============================================================
        // CLOSE DIALOG
        // ============================================================

        onCloseRailDetails: function () {

            this.byId(
                "_IDGenRailDetailsDialog"
            ).close();
        },


        // ============================================================
        // EMPTY KPI STATE
        // ============================================================

        _setEmptyRailKpis: function () {

            var oModel =
                this.getView().getModel(
                    "railHealth"
                );

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
        },


        // ============================================================
        // DATE FORMAT
        // ============================================================

        _formatDateForOData: function (
            vDate
        ) {

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
                    String(iMonth)
                        .padStart(2, "0") +
                    "-" +
                    String(iDay)
                        .padStart(2, "0")
                );
            }

            return null;
        },


        // ============================================================
        // NORMALISE DATE
        // ============================================================

        _normaliseDate: function (
            vDate
        ) {

            if (!vDate) {
                return null;
            }

            if (vDate instanceof Date) {

                return this._formatDateForOData(
                    vDate
                );
            }

            return String(
                vDate
            ).substring(
                0,
                10
            );
        },


        // ============================================================
        // ADD ONE DAY
        // ============================================================

        _addOneDay: function (
            sIsoDate
        ) {

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
                String(iMonth)
                    .padStart(2, "0") +
                "-" +
                String(iDay)
                    .padStart(2, "0")
            );
        },


        // ============================================================
        // PERCENT FORMAT
        // ============================================================

        _formatPercent: function (
            fValue
        ) {

            return (
                Number(fValue).toFixed(2) +
                "%"
            );
        },


        // ============================================================
        // NUMBER FORMAT
        // ============================================================

        _formatNumber: function (
            iValue
        ) {

            var fNumber =
                Number(iValue || 0);

            if (fNumber >= 1000000) {

                return (
                    (fNumber / 1000000)
                        .toFixed(2) +
                    "M"
                );
            }

            if (fNumber >= 1000) {

                return (
                    (fNumber / 1000)
                        .toFixed(1) +
                    "K"
                );
            }

            return String(
                fNumber
            );
        },


        // ============================================================
        // RESPONSE TIME FORMAT
        // ============================================================

        _formatResponseTime: function (
            fValue
        ) {

            return (
                Number(fValue).toFixed(2) +
                " ms"
            );
        }

    });

});