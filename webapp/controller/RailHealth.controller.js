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
                // RAIL FILTER DROPDOWN OPTIONS (populated from real
                // OData PaymentRail values once data loads — see
                // _updateRailKpis)
                // ====================================================

                availableRails: [
                    { key: "All", text: "All" }
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

    var sPostingDate =
        oFilterModel.getProperty("/kpiDate");

    var sCreatedOn =
        oFilterModel.getProperty("/createdOn");

    /*
     * Normalize dates
     */
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

    /*
     * Load Rail Health using ALL THREE
     * global filter values.
     */
    this._loadRailHealthKpis(
        sClearingArea,
        sPostingDate,
        sCreatedOn
    );
},

        // ============================================================
        // LOAD ALL KPI DATA
        //
        // OData Entity:
        // /RailHealthKpi
        //
        // NOTE: this entity returns ONE ROW PER PaymentRail for a
        // given ClearingArea + CreatedOn (e.g. BOI / 2025-12-16 has
        // separate rows for /SWIFTMX and /BOFFICE). So the result of
        // this load must stay an ARRAY all the way through — never
        // collapsed to a single record — otherwise every rail but one
        // silently disappears from the table.
        //
        // Fields used:
        // ClearingArea, CreatedOn, PaymentRail, ActiveRailPercentage,
        // SuccessRate, FailedRate, QueueDepth, CriticalAlertRate,
        // ActiveRailCount, TotalRailCount, Transactions, ResponseTime,
        // CriticalAlerts, OverallHealth
        // ============================================================

      _loadRailHealthKpis: function (
    sClearingArea,
    sPostingDate,
    sCreatedOn
) {

    var oRailModel =
        this.getView().getModel("railHealth");

    if (!oRailModel) {
        console.error("Rail Health: railHealth model missing");
        return;
    }

    if (!sClearingArea) {
        console.warn("Rail Health: Clearing Area missing");
        this._setEmptyRailKpis();
        return;
    }

    /*
     * =========================================================
     * NORMALIZE DATE VALUES
     * =========================================================
     */

    var fnNormalizeDate = function (vDate) {

        if (!vDate) {
            return "";
        }

        if (vDate instanceof Date) {

            return (
                vDate.getFullYear() +
                "-" +
                String(vDate.getMonth() + 1).padStart(2, "0") +
                "-" +
                String(vDate.getDate()).padStart(2, "0")
            );
        }

        return String(vDate).substring(0, 10);
    };

    sPostingDate = fnNormalizeDate(sPostingDate);
    sCreatedOn = fnNormalizeDate(sCreatedOn);


    console.log("======================================");
    console.log("RAIL HEALTH FILTER");
    console.log("Clearing Area :", sClearingArea);
    console.log("Posting Date  :", sPostingDate);
    console.log("Created On    :", sCreatedOn);
    console.log("======================================");


    /*
     * =========================================================
     * IMPORTANT
     * =========================================================
     *
     * RailHealthKpi contains:
     *
     * ClearingArea
     * CreatedOn
     * PaymentRail
     * KPI fields
     *
     * It does NOT expose PostingDate / PaymentOrderDate.
     *
     * Therefore:
     *
     * Clearing Area -> applied here
     * Created On    -> applied here
     *
     * Posting Date  -> retained as global context
     *
     * We must NOT compare Posting Date to CreatedOn.
     */


    var sServiceUrl =
        "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/";

    var sEntityUrl =
        sServiceUrl + "RailHealthKpi";


    /*
     * =========================================================
     * BUILD SERVER FILTER
     * =========================================================
     */

    var aUrlFilters = [];

    if (sClearingArea) {

        aUrlFilters.push(
            "ClearingArea eq '" +
            encodeURIComponent(sClearingArea).replace(/%20/g, " ") +
            "'"
        );
    }

    if (sCreatedOn) {

        aUrlFilters.push(
            "CreatedOn eq " + sCreatedOn
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


    /*
     * =========================================================
     * READ ALL ODATA PAGES
     * =========================================================
     *
     * Do not stop at the first 100 rows.
     */

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


            /*
             * OData V4 next page
             */

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


    /*
     * =========================================================
     * LOAD DATA
     * =========================================================
     */

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


        /*
         * =====================================================
         * SAFETY FILTER — CLEARING AREA
         * =====================================================
         */

        var aMatchingRecords =
            aData.filter(function (oItem) {

                return String(
                    oItem.ClearingArea || ""
                ) === String(
                    sClearingArea
                );
            });


        /*
         * =====================================================
         * SAFETY FILTER — CREATED ON
         * =====================================================
         */

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


        /*
         * =====================================================
         * DEBUG MATCHING RECORDS
         * =====================================================
         */

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


        /*
         * =====================================================
         * NO DATA
         * =====================================================
         */

        if (!aMatchingRecords.length) {

            this._setEmptyRailKpis();
            return;
        }


        /*
         * =====================================================
         * UPDATE KPI TILES
         * =====================================================
         */

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
        // UPDATE ALL KPI TILES + TABLE
        //
        // aRecords = every /RailHealthKpi row matching the selected
        // ClearingArea + date (one per PaymentRail). KPI tiles show a
        // transaction-weighted aggregate across all of them; the
        // table shows one real row per PaymentRail.
        // ============================================================

        _updateRailKpis: function (aRecords) {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel || !aRecords || !aRecords.length) {
                return;
            }

            // ========================================================
            // AGGREGATE ACROSS ALL PAYMENT RAILS FOR THIS DATE
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

                var iTx = Number(oItem.Transactions || 0);

                iTotalTransactions += iTx;
                iTotalCriticalAlerts += Number(oItem.CriticalAlerts || 0);

                fResponseTimeWeighted += Number(oItem.ResponseTime || 0) * iTx;
                fSuccessRateWeighted += Number(oItem.SuccessRate || 0) * iTx;
                fFailedRateWeighted += Number(oItem.FailedRate || 0) * iTx;
                fQueueDepthWeighted += Number(oItem.QueueDepth || 0) * iTx;
                fOverallHealthWeighted += Number(oItem.OverallHealth || 0) * iTx;

                var sRail = oItem.PaymentRail || "Unspecified";

                if (aDistinctRails.indexOf(sRail) === -1) {
                    aDistinctRails.push(sRail);
                }
            });

            var fResponseTime = iTotalTransactions > 0
                ? fResponseTimeWeighted / iTotalTransactions
                : 0;

            var fSuccessRate = iTotalTransactions > 0
                ? fSuccessRateWeighted / iTotalTransactions
                : 0;

            var fFailedRate = iTotalTransactions > 0
                ? fFailedRateWeighted / iTotalTransactions
                : 0;

            var fQueueDepth = iTotalTransactions > 0
                ? fQueueDepthWeighted / iTotalTransactions
                : 0;

            var fOverallHealth = iTotalTransactions > 0
                ? fOverallHealthWeighted / iTotalTransactions
                : 0;

            var iActiveRailCount = aDistinctRails.length;
            var iTotalRailCount = Number(aRecords[0].TotalRailCount || 0);

            // ========================================================
            // KPI TILES
            // ========================================================

            oModel.setProperty(
                "/kpis/transactions",
                this._formatNumber(iTotalTransactions)
            );
            oModel.setProperty("/kpis/transactionsSub", "Total transactions");

            oModel.setProperty(
                "/kpis/successRate",
                this._formatPercent(fSuccessRate)
            );
            oModel.setProperty("/kpis/successRateSub", "Across selected payment rail");

            oModel.setProperty(
                "/kpis/failedPayments",
                this._formatPercent(fFailedRate)
            );
            oModel.setProperty("/kpis/failedPaymentsSub", "Of total transactions");

            oModel.setProperty(
                "/kpis/responseTime",
                this._formatResponseTime(fResponseTime)
            );
            oModel.setProperty("/kpis/responseTimeSub", "Average response time");

           oModel.setProperty(
    "/kpis/queueDepth",
    Number(fQueueDepth).toFixed(3)
);
            oModel.setProperty("/kpis/queueDepthSub", "Transactions in queue");

            oModel.setProperty("/kpis/alerts", String(iTotalCriticalAlerts));
            oModel.setProperty(
                "/kpis/alertsSub",
                iTotalCriticalAlerts > 0 ? "Require attention" : "No critical alerts"
            );

            oModel.setProperty(
                "/kpis/overallHealth",
                this._formatPercent(fOverallHealth)
            );
            oModel.setProperty("/kpis/overallHealthSub", "From RailHealthKpi");

            oModel.setProperty(
                "/kpis/activeRails",
                iActiveRailCount + " / " + iTotalRailCount
            );
            oModel.setProperty("/kpis/activeRailsSub", "Active for selected filter");

            // ========================================================
            // TABLE — ONE ROW PER PAYMENT RAIL (real data)
            // ========================================================

            var aRailRows = aRecords.map(function (oItem) {

                var fHealth = Number(oItem.OverallHealth || 0);

                var sStatus = "Healthy";

                if (fHealth < 20) {
                    sStatus = "Critical";
                } else if (fHealth < 35) {
                    sStatus = "Warning";
                }

                var sRailName = oItem.PaymentRail
                    ? oItem.PaymentRail.replace(/^\//, "")
                    : "Unspecified";

                return {
                    rail: sRailName,
                    status: sStatus,
                    successRate: this._formatPercent(Number(oItem.SuccessRate || 0)),
                    responseTime: this._formatResponseTime(Number(oItem.ResponseTime || 0)),
                    volume: this._formatNumber(Number(oItem.Transactions || 0)),
                    selected: false
                };

            }.bind(this));

            console.log("RAIL TABLE ROWS CREATED:", aRailRows);

            oModel.setProperty("/railOverview", aRailRows);
            oModel.setProperty("/filteredRailOverview", aRailRows);
            oModel.setProperty("/allRailsSelected", false);

            // ========================================================
            // RAIL FILTER DROPDOWN — populate from real rails present
            // ========================================================

            var aAvailableRails = [
                { key: "All", text: "All" }
            ].concat(
                aRailRows
                    .map(function (oRow) { return oRow.rail; })
                    .filter(function (sRail, iIndex, aArr) {
                        return aArr.indexOf(sRail) === iIndex;
                    })
                    .map(function (sRail) {
                        return { key: sRail, text: sRail };
                    })
            );

            oModel.setProperty("/availableRails", aAvailableRails);

            oModel.refresh(true);

            console.log(
                "FINAL RAIL TABLE DATA:",
                JSON.stringify(aRailRows)
            );

            // ========================================================
            // TABLE DEBUG
            // ========================================================

            setTimeout(function () {

                var oTable =
                    this.byId("_IDGenRailOverviewTable");

                if (!oTable) {
                    console.error("RAIL TABLE NOT FOUND");
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
                    oBinding ? oBinding.getLength() : "NO BINDING"
                );

                console.log(
                    "RAIL TABLE MODEL DATA:",
                    oTable.getModel("railHealth")
                        ? oTable.getModel("railHealth").getProperty("/filteredRailOverview")
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
                oModel.getProperty("/filteredRailOverview") || [];

            aRails.forEach(function (oRail) {
                oRail.selected = bSelected;
            });

            oModel.setProperty("/filteredRailOverview", aRails);
            oModel.setProperty("/allRailsSelected", bSelected);
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
                oEvent.getSource().getBindingContext("railHealth");

            if (!oContext) {
                return;
            }

            var bSelected =
                oEvent.getParameter("selected");

            oContext.getModel().setProperty(
                oContext.getPath() + "/selected",
                bSelected
            );

            var aRails =
                oModel.getProperty("/filteredRailOverview") || [];

            var bAllSelected =
                aRails.length > 0 &&
                aRails.every(function (oRail) {
                    return oRail.selected === true;
                });

            oModel.setProperty("/allRailsSelected", bAllSelected);
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
                oModel.getProperty("/railFilters/rail");

            var sStatus =
                oModel.getProperty("/railFilters/status");

            var aAllRails =
                oModel.getProperty("/railOverview") || [];

            var aFilteredRails =
                aAllRails.filter(function (oRail) {

                    var bRailMatch =
                        sRail === "All" || oRail.rail === sRail;

                    var bStatusMatch =
                        sStatus === "All" || oRail.status === sStatus;

                    return bRailMatch && bStatusMatch;
                });

            oModel.setProperty("/filteredRailOverview", aFilteredRails);

            oModel.setProperty(
                "/allRailsSelected",
                aFilteredRails.length > 0 &&
                aFilteredRails.every(function (oRail) {
                    return oRail.selected === true;
                })
            );
        },


        // ============================================================
        // ROW PRESS
        // ============================================================

        onRailRowPress: function (oEvent) {

            var oContext =
                oEvent.getSource().getBindingContext("railHealth");

            if (!oContext) {
                return;
            }

            var oSelectedRail =
                oContext.getObject();

            var oModel =
                this.getView().getModel("railHealth");

            oModel.setProperty("/selectedRail", oSelectedRail);
            oModel.setProperty("/railDetailsDirection", "Incoming");

            this._loadRailDetails(oSelectedRail.rail, "Incoming");

            this.byId("_IDGenRailDetailsDialog").open();
        },


        // ============================================================
        // DETAILS DIRECTION
        // ============================================================

        onRailDetailsDirectionChange: function (oEvent) {

            var sDirection =
                oEvent.getParameter("item").getKey();

            var oModel =
                this.getView().getModel("railHealth");

            var oSelectedRail =
                oModel.getProperty("/selectedRail");

            oModel.setProperty("/railDetailsDirection", sDirection);

            if (!oSelectedRail || !oSelectedRail.rail) {
                return;
            }

            this._loadRailDetails(oSelectedRail.rail, sDirection);
        },


        // ============================================================
        // RAIL DETAILS
        //
        // No detail OData entity was supplied. Keep this method for
        // the dialog (still uses placeholder data).
        // ============================================================

        _loadRailDetails: function (sRail, sDirection) {

            var oModel =
                this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            console.log("Loading rail details:", sRail, sDirection);

            var aIncomingDetails = [
                { date: "29-Sep-2026", status: "Healthy", successRate: "99.98%", responseTime: "2.1 sec", volume: "120K" },
                { date: "28-Sep-2026", status: "Healthy", successRate: "99.95%", responseTime: "2.4 sec", volume: "105K" },
                { date: "27-Sep-2026", status: "Healthy", successRate: "99.97%", responseTime: "2.2 sec", volume: "98K" },
                { date: "26-Sep-2026", status: "Warning", successRate: "98.91%", responseTime: "3.8 sec", volume: "87K" }
            ];

            var aOutgoingDetails = [
                { date: "29-Sep-2026", status: "Healthy", successRate: "99.94%", responseTime: "2.3 sec", volume: "115K" },
                { date: "28-Sep-2026", status: "Healthy", successRate: "99.92%", responseTime: "2.5 sec", volume: "101K" },
                { date: "27-Sep-2026", status: "Healthy", successRate: "99.96%", responseTime: "2.1 sec", volume: "96K" },
                { date: "26-Sep-2026", status: "Warning", successRate: "98.88%", responseTime: "3.6 sec", volume: "82K" }
            ];

            var aDetails =
                sDirection === "Outgoing" ? aOutgoingDetails : aIncomingDetails;

            oModel.setProperty("/railDetails", aDetails);
        },


        // ============================================================
        // CLOSE DIALOG
        // ============================================================

        onCloseRailDetails: function () {
            this.byId("_IDGenRailDetailsDialog").close();
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

            oModel.setProperty("/kpis/overallHealth", "0%");
            oModel.setProperty("/kpis/overallHealthSub", "No data for this filter");

            oModel.setProperty("/kpis/activeRails", "0 / 0");
            oModel.setProperty("/kpis/activeRailsSub", "No data for this filter");

            oModel.setProperty("/kpis/transactions", "0");
            oModel.setProperty("/kpis/transactionsSub", "No data for this filter");

            oModel.setProperty("/kpis/successRate", "0%");
            oModel.setProperty("/kpis/successRateSub", "No data for this filter");

            oModel.setProperty("/kpis/failedPayments", "0%");
            oModel.setProperty("/kpis/failedPaymentsSub", "No data for this filter");

            oModel.setProperty("/kpis/responseTime", "0 ms");
            oModel.setProperty("/kpis/responseTimeSub", "No data for this filter");

            oModel.setProperty("/kpis/queueDepth", "0");
            oModel.setProperty("/kpis/queueDepthSub", "No data for this filter");

            oModel.setProperty("/kpis/alerts", "0");
            oModel.setProperty("/kpis/alertsSub", "No data for this filter");

            oModel.setProperty("/railOverview", []);
            oModel.setProperty("/filteredRailOverview", []);
            oModel.setProperty("/allRailsSelected", false);

            oModel.setProperty("/availableRails", [{ key: "All", text: "All" }]);
        },


        // ============================================================
        // DATE FORMAT
        // ============================================================

        _formatDateForOData: function (vDate) {

            if (!vDate) {
                return null;
            }

            if (typeof vDate === "string") {
                return vDate.substring(0, 10);
            }

            if (vDate instanceof Date) {

                var iYear = vDate.getFullYear();
                var iMonth = vDate.getMonth() + 1;
                var iDay = vDate.getDate();

                return (
                    iYear + "-" +
                    String(iMonth).padStart(2, "0") + "-" +
                    String(iDay).padStart(2, "0")
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
                return this._formatDateForOData(vDate);
            }

            return String(vDate).substring(0, 10);
        },


        // ============================================================
        // ADD ONE DAY
        // ============================================================

        _addOneDay: function (sIsoDate) {

            if (!sIsoDate) {
                return null;
            }

            var oDate = new Date(sIsoDate + "T00:00:00");

            oDate.setDate(oDate.getDate() + 1);

            var iYear = oDate.getFullYear();
            var iMonth = oDate.getMonth() + 1;
            var iDay = oDate.getDate();

            return (
                iYear + "-" +
                String(iMonth).padStart(2, "0") + "-" +
                String(iDay).padStart(2, "0")
            );
        },


        // ============================================================
        // PERCENT FORMAT
        // ============================================================

        _formatPercent: function (fValue) {
            return Number(fValue).toFixed(2) + "%";
        },


        // ============================================================
        // NUMBER FORMAT
        // ============================================================

        _formatNumber: function (iValue) {

            var fNumber = Number(iValue || 0);

            if (fNumber >= 1000000) {
                return (fNumber / 1000000).toFixed(2) + "M";
            }

            if (fNumber >= 1000) {
                return (fNumber / 1000).toFixed(1) + "K";
            }

            return String(fNumber);
        },


        // ============================================================
        // RESPONSE TIME FORMAT
        // ============================================================

        _formatResponseTime: function (fValue) {
            return Number(fValue).toFixed(2) + " ms";
        }

    });

});