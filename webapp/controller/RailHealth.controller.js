sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/library"
], function (
    Controller,
    JSONModel,
    coreLibrary
) {

    "use strict";

    var ValueState = coreLibrary.ValueState;

    // ================================================================
    // PAYMENT ORDER TECHNICAL STATUS GROUPS
    // Same groupings as the Overview tab (View1.controller.js)
    // ================================================================

    var ORDER_STATUS_SUCCESS = ["128", "130", "230", "270"];
    var ORDER_STATUS_FAILED = ["114", "170"];
    var ORDER_STATUS_REJECTED = ["172", "173"];
    var ORDER_STATUS_PENDING = [
        "39", "35", "37", "110", "115", "117", "118", "119", "120",
        "176", "177", "178", "179", "180", "101", "103", "105"
    ];

    return Controller.extend("payment.dashboard.controller.RailHealth", {

        // ============================================================
        // INITIALIZATION
        // ============================================================

        onInit: function () {

            var oRailHealthModel = new JSONModel({

                allRailsSelected: false,

                globalFilter: {
                    clearingArea: "",
                    date: "",
                    createdOn: ""
                },

                availableRails: [
                    { key: "All", text: "All" }
                ],

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

                railOverview: [],
                filteredRailOverview: [],

                railFilters: {
                    rail: "All",
                    status: "All"
                },

                selectedRail: {
                    channel: "",
                    medium: "",
                    status: "",
                    successRate: "",
                    responseTime: "",
                    queueDepth: "",
                    createdOn: ""
                },

                // ====================================================
                // ✅ NEW — PAYMENT ORDERS FOR SELECTED CHANNEL
                // ====================================================

                railOrders: [],
                railOrdersBusy: false,
                railOrdersTitle: "",
                railOrdersInfo: ""
            });

            this.getView().setModel(oRailHealthModel, "railHealth");
        },


        // ============================================================
        // AFTER RENDERING
        // ============================================================

        onAfterRendering: function () {

            if (this._bInitialLoadDone) {
                return;
            }

            var oFilterModel = this.getView().getModel("filterModel");

            if (!oFilterModel) {
                console.warn("Rail Health: filterModel still not found at onAfterRendering");
                return;
            }

            this._bInitialLoadDone = true;

            console.log("Rail Health: initial load via onAfterRendering");

            this.onFilterChange();
        },


        // ============================================================
        // MAIN DASHBOARD FILTER CHANGE
        // ============================================================

        onFilterChange: function () {

            var oFilterModel = this.getView().getModel("filterModel");

            if (!oFilterModel) {
                console.warn("Rail Health: filterModel not found");
                return;
            }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sPostingDate = this._normaliseDate(oFilterModel.getProperty("/kpiDate")) || "";
            var sCreatedOn = this._normaliseDate(oFilterModel.getProperty("/createdOn")) || "";

            console.log("Rail Health global filter:", {
                clearingArea: sClearingArea,
                postingDate: sPostingDate,
                createdOn: sCreatedOn
            });

            var oRailModel = this.getView().getModel("railHealth");

            if (oRailModel) {
                oRailModel.setProperty("/globalFilter/clearingArea", sClearingArea);
                oRailModel.setProperty("/globalFilter/date", sPostingDate);
                oRailModel.setProperty("/globalFilter/createdOn", sCreatedOn);
            }

            this._loadRailHealthKpis(sClearingArea, sPostingDate, sCreatedOn);
        },


        // ============================================================
        // LOAD RAIL HEALTH KPI DATA  (/RailHealthKpi)
        //
        // Server-side: ClearingArea only.
        // CreatedOn is applied locally after ALL pages are loaded.
        // ============================================================

        _loadRailHealthKpis: function (sClearingArea, sPostingDate, sCreatedOn) {

            var oRailModel = this.getView().getModel("railHealth");

            if (!oRailModel) {
                console.error("Rail Health: railHealth model missing");
                return;
            }

            if (!sClearingArea) {
                console.warn("Rail Health: Clearing Area missing");
                this._setEmptyRailKpis();
                return;
            }

            var sUrl =
                this._getServiceUrl() +
                "RailHealthKpi?$filter=" +
                encodeURIComponent(
                    "ClearingArea eq '" + String(sClearingArea).replace(/'/g, "''") + "'"
                );

            console.log("Rail Health OData URL:", sUrl);

            this._fetchAllPages(sUrl)

                .then(function (aData) {

                    console.log("Rail Health: TOTAL rows loaded:", aData.length);
                    console.log("Rail Health: first rows:", aData.slice(0, 5));

                    var aMatchingRecords = aData.filter(function (oItem) {

                        if (String(oItem.ClearingArea || "") !== String(sClearingArea)) {
                            return false;
                        }

                        if (sCreatedOn && this._normaliseDate(oItem.CreatedOn) !== sCreatedOn) {
                            return false;
                        }

                        return true;

                    }.bind(this));

                    console.log("Rail Health: records after filters:", aMatchingRecords.length);

                    if (!aMatchingRecords.length) {
                        console.warn("Rail Health: NO matching records", {
                            clearingArea: sClearingArea,
                            createdOn: sCreatedOn
                        });
                        this._setEmptyRailKpis();
                        return;
                    }

                    this._updateRailKpis(aMatchingRecords);

                }.bind(this))

                .catch(function (oError) {
                    console.error("Rail Health RailHealthKpi load failed:", oError);
                    this._setEmptyRailKpis();
                }.bind(this));
        },


        // ============================================================
        // UPDATE KPI TILES + TABLE
        // ============================================================

        _updateRailKpis: function (aRecords) {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel || !aRecords || !aRecords.length) {
                return;
            }

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

                var sRail = oItem.PaymentRail || "";

                if (sRail && aDistinctRails.indexOf(sRail) === -1) {
                    aDistinctRails.push(sRail);
                }
            });

            var fnAvg = function (fWeighted) {
                return iTotalTransactions > 0 ? fWeighted / iTotalTransactions : 0;
            };

            var iTotalRailCount = Number(aRecords[0].TotalRailCount || 0);

            // ---------------- KPI TILES ----------------

            oModel.setProperty("/kpis/transactions", this._formatNumber(iTotalTransactions));
            oModel.setProperty("/kpis/transactionsSub", "Total transactions");

            oModel.setProperty("/kpis/successRate", this._formatPercent(fnAvg(fSuccessRateWeighted)));
            oModel.setProperty("/kpis/successRateSub", "Across selected payment rail");

            oModel.setProperty("/kpis/failedPayments", this._formatPercent(fnAvg(fFailedRateWeighted)));
            oModel.setProperty("/kpis/failedPaymentsSub", "Of total transactions");

            oModel.setProperty("/kpis/responseTime", this._formatResponseTime(fnAvg(fResponseTimeWeighted)));
            oModel.setProperty("/kpis/responseTimeSub", "Average response time");

            oModel.setProperty("/kpis/queueDepth", Number(fnAvg(fQueueDepthWeighted)).toFixed(3));
            oModel.setProperty("/kpis/queueDepthSub", "Transactions in queue");

            oModel.setProperty("/kpis/alerts", String(iTotalCriticalAlerts));
            oModel.setProperty(
                "/kpis/alertsSub",
                iTotalCriticalAlerts > 0 ? "Require attention" : "No critical alerts"
            );

            oModel.setProperty("/kpis/overallHealth", this._formatPercent(fnAvg(fOverallHealthWeighted)));
            oModel.setProperty("/kpis/overallHealthSub", "From RailHealthKpi");

            oModel.setProperty("/kpis/activeRails", aDistinctRails.length + " / " + iTotalRailCount);
            oModel.setProperty("/kpis/activeRailsSub", "Active for selected filter");

            // ---------------- TABLE ROWS ----------------

            var aRailRows = aRecords.map(function (oItem) {

                return {
                    channel: oItem.PaymentRail
                        ? String(oItem.PaymentRail).replace(/^\/+/, "")
                        : "",

                    medium: oItem.Medium
                        ? String(oItem.Medium).replace(/^\/+/, "")
                        : "",

                    status: oItem.HealthStatus || "",

                    successRate: this._formatPercent(Number(oItem.SuccessRate || 0)),

                    responseTime: this._formatResponseTime(Number(oItem.ResponseTime || 0)),

                    queueDepth: Number(oItem.QueueDepth || 0).toFixed(2),

                    createdOn: this._formatDisplayDate(oItem.CreatedOn),

                    createdOnRaw: this._normaliseDate(oItem.CreatedOn) || "",

                    oData: oItem,

                    selected: false
                };

            }.bind(this));

            oModel.setProperty("/railOverview", aRailRows);

            // Re-apply Rail / Status / Created On table filters
            this.onRailFilterChange();

            // ---------------- CHANNEL DROPDOWN ----------------

            var aChannels = [];

            aRailRows.forEach(function (oRow) {
                if (oRow.channel && aChannels.indexOf(oRow.channel) === -1) {
                    aChannels.push(oRow.channel);
                }
            });

            oModel.setProperty(
                "/availableRails",
                [{ key: "All", text: "All" }].concat(
                    aChannels.map(function (sChannel) {
                        return { key: sChannel, text: sChannel };
                    })
                )
            );

            oModel.refresh(true);
        },


        // ============================================================
        // SELECT ALL
        // ============================================================

        onRailSelectAll: function (oEvent) {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var bSelected = oEvent.getParameter("selected");
            var aRails = oModel.getProperty("/filteredRailOverview") || [];

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

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var oContext = oEvent.getSource().getBindingContext("railHealth");

            if (!oContext) {
                return;
            }

            oModel.setProperty(
                oContext.getPath() + "/selected",
                oEvent.getParameter("selected")
            );

            var aRails = oModel.getProperty("/filteredRailOverview") || [];

            oModel.setProperty(
                "/allRailsSelected",
                aRails.length > 0 && aRails.every(function (oRail) {
                    return oRail.selected === true;
                })
            );
        },


        // ============================================================
        // TABLE FILTER (Rail / Status / global Created On)
        // ============================================================

        onRailFilterChange: function () {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var sRail = oModel.getProperty("/railFilters/rail");
            var sStatus = oModel.getProperty("/railFilters/status");
            var sCreatedOn = oModel.getProperty("/globalFilter/createdOn") || "";
            var aAllRails = oModel.getProperty("/railOverview") || [];

            var aFilteredRails = aAllRails.filter(function (oRail) {

                var bRailMatch = sRail === "All" || oRail.channel === sRail;
                var bStatusMatch = sStatus === "All" || oRail.status === sStatus;
                var bCreatedOnMatch = !sCreatedOn || oRail.createdOnRaw === sCreatedOn;

                return bRailMatch && bStatusMatch && bCreatedOnMatch;
            });

            oModel.setProperty("/filteredRailOverview", aFilteredRails);

            oModel.setProperty(
                "/allRailsSelected",
                aFilteredRails.length > 0 && aFilteredRails.every(function (oRail) {
                    return oRail.selected === true;
                })
            );
        },


        // ============================================================
        // ✅ ROW PRESS — open dialog with PaymentInfo orders for
        // the clicked row's channel
        // ============================================================

        onRailRowPress: function (oEvent) {

            var oContext = oEvent.getSource().getBindingContext("railHealth");

            if (!oContext) {
                return;
            }

            var oSelectedRail = oContext.getObject();
            var oModel = this.getView().getModel("railHealth");

            oModel.setProperty("/selectedRail", oSelectedRail);

            console.log("SELECTED RAIL ROW:", oSelectedRail);

            var oDialog = this.byId("_IDGenRailDetailsDialog");

            if (oDialog) {
                oDialog.open();
            }

            this._loadRailOrders(oSelectedRail.channel);
        },


        // ============================================================
        // ✅ NEW — LOAD PAYMENT ORDERS (PaymentInfo) FOR A CHANNEL
        //
        // Server-side : ClearingArea (+ CreatedOn when set)
        // Client-side : Channel match (normalised) + CreatedOn safety
        // ============================================================

        _loadRailOrders: function (sChannel) {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var oGlobalFilter = oModel.getProperty("/globalFilter") || {};
            var sClearingArea = oGlobalFilter.clearingArea || "";
            var sCreatedOn = oGlobalFilter.createdOn || "";
            var sTargetChannel = this._normaliseChannel(sChannel);

            oModel.setProperty("/railOrders", []);
            oModel.setProperty("/railOrdersBusy", true);
            oModel.setProperty("/railOrdersTitle", sChannel + " – Payment Orders");
            oModel.setProperty(
                "/railOrdersInfo",
                "Clearing Area: " + (sClearingArea || "–") +
                "   |   Created On: " + (sCreatedOn ? this._formatDisplayDate(sCreatedOn) : "All dates")
            );

            if (!sClearingArea) {
                console.warn("Rail orders: Clearing Area missing");
                oModel.setProperty("/railOrdersBusy", false);
                return;
            }

            // ---------------- SERVER FILTER ----------------

            var aFilters = [
                "ClearingArea eq '" + String(sClearingArea).replace(/'/g, "''") + "'"
            ];

            if (sCreatedOn) {
                aFilters.push("CreatedOn eq " + sCreatedOn);
            }

            var sUrl =
                this._getServiceUrl() +
                "PaymentInfo?$filter=" +
                encodeURIComponent(aFilters.join(" and "));

            console.log("Rail orders PaymentInfo URL:", sUrl);

            this._fetchAllPages(sUrl)

                .then(function (aData) {

                    console.log("Rail orders: rows loaded:", aData.length);

                    // ---------------- CLIENT FILTER ----------------

                    var aOrders = aData.filter(function (oItem) {

                        if (this._normaliseChannel(oItem.Channel) !== sTargetChannel) {
                            return false;
                        }

                        if (sCreatedOn && this._normaliseDate(oItem.CreatedOn) !== sCreatedOn) {
                            return false;
                        }

                        return true;

                    }.bind(this));

                    // ---------------- MAP TO DIALOG ROWS ----------------

                    var aRows = aOrders.map(function (oItem) {

                        var sStatus = String(oItem.TechnicalStatus || "");

                        return {
                            orderKey: oItem.OrderKey || "",
                            paymentOrderNumber: oItem.PaymentOrderNumber || "",
                            paymentOrderDate: this._formatDisplayDate(oItem.PaymentOrderDate),
                            technicalStatus: sStatus,
                            technicalStatusText: this._formatOrderStatusText(sStatus),
                            technicalStatusState: this._formatOrderStatusState(sStatus),
                            createdOn: this._formatDisplayDate(oItem.CreatedOn),
                            createdBy: oItem.CreatedBy || "",
                            releasedBy: oItem.ReleasedBy || "",
                            lastChangedBy: oItem.LastChangedBy || "",
                            orderFormat: oItem.OrderFormat || "",
                            medium: oItem.Medium || "",
                            channel: oItem.Channel || "",
                            oData: oItem
                        };

                    }.bind(this));

                    console.log("Rail orders: rows for channel", sChannel, ":", aRows.length);

                    oModel.setProperty("/railOrders", aRows);
                    oModel.setProperty(
                        "/railOrdersTitle",
                        sChannel + " – Payment Orders (" + aRows.length + ")"
                    );

                }.bind(this))

                .catch(function (oError) {

                    console.error("Rail orders PaymentInfo load failed:", oError);
                    oModel.setProperty("/railOrders", []);

                })

                .finally(function () {
                    oModel.setProperty("/railOrdersBusy", false);
                });
        },


        // ============================================================
        // CLOSE DIALOG
        // ============================================================

        onCloseRailDetails: function () {

            var oDialog = this.byId("_IDGenRailDetailsDialog");

            if (oDialog) {
                oDialog.close();
            }
        },


        // ============================================================
        // EMPTY KPI STATE
        // ============================================================

        _setEmptyRailKpis: function () {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            var sNoData = "No data for this filter";

            oModel.setProperty("/kpis", {
                overallHealth: "0%",
                overallHealthSub: sNoData,
                activeRails: "0 / 0",
                activeRailsSub: sNoData,
                transactions: "0",
                transactionsSub: sNoData,
                successRate: "0%",
                successRateSub: sNoData,
                failedPayments: "0%",
                failedPaymentsSub: sNoData,
                responseTime: "0 ms",
                responseTimeSub: sNoData,
                queueDepth: "0",
                queueDepthSub: sNoData,
                alerts: "0",
                alertsSub: sNoData
            });

            oModel.setProperty("/railOverview", []);
            oModel.setProperty("/filteredRailOverview", []);
            oModel.setProperty("/allRailsSelected", false);
            oModel.setProperty("/availableRails", [{ key: "All", text: "All" }]);
        },


        // ============================================================
        // HELPERS — SERVICE / PAGING
        // ============================================================

        _getServiceUrl: function () {

            var sUri = this.getOwnerComponent().getManifestEntry(
                "/sap.app/dataSources/mainService/uri"
            ) || "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/";

            sUri = sUri.split("?")[0];

            return sUri.charAt(sUri.length - 1) === "/" ? sUri : sUri + "/";
        },

        // Reads every OData page by following @odata.nextLink
        _fetchAllPages: function (sUrl) {

            var fnReadPage = function (sPageUrl, aAllRows) {

                return fetch(sPageUrl, {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "same-origin"
                })

                    .then(function (oResponse) {

                        if (!oResponse.ok) {
                            return oResponse.text().then(function (sBody) {
                                throw new Error("HTTP " + oResponse.status + " | " + sBody);
                            });
                        }

                        return oResponse.json();
                    })

                    .then(function (oPayload) {

                        var aRows = oPayload && Array.isArray(oPayload.value)
                            ? oPayload.value
                            : [];

                        aAllRows.push.apply(aAllRows, aRows);

                        var sNextLink = oPayload["@odata.nextLink"];

                        return sNextLink
                            ? fnReadPage(sNextLink, aAllRows)
                            : aAllRows;
                    });
            };

            return fnReadPage(sUrl, []);
        },


        // ============================================================
        // HELPERS — NORMALISATION
        // ============================================================

        _normaliseChannel: function (vChannel) {

            return String(vChannel || "")
                .trim()
                .replace(/^\/+/, "")
                .toUpperCase();
        },

        _normaliseDate: function (vDate) {

            if (!vDate) {
                return null;
            }

            if (vDate instanceof Date) {
                return vDate.getFullYear() + "-" +
                    String(vDate.getMonth() + 1).padStart(2, "0") + "-" +
                    String(vDate.getDate()).padStart(2, "0");
            }

            return String(vDate).substring(0, 10);
        },


        // ============================================================
        // HELPERS — FORMATTING
        // ============================================================

        _formatDisplayDate: function (vDate) {

            var sIso = this._normaliseDate(vDate);

            if (!sIso) {
                return "";
            }

            var aParts = sIso.split("-");

            return aParts.length === 3
                ? aParts[2] + "." + aParts[1] + "." + aParts[0]
                : sIso;
        },

        _formatOrderStatusText: function (sStatus) {

            if (ORDER_STATUS_SUCCESS.indexOf(sStatus) !== -1) {
                return sStatus + " - Successful";
            }
            if (ORDER_STATUS_FAILED.indexOf(sStatus) !== -1) {
                return sStatus + " - Failed";
            }
            if (ORDER_STATUS_REJECTED.indexOf(sStatus) !== -1) {
                return sStatus + " - Rejected";
            }
            if (ORDER_STATUS_PENDING.indexOf(sStatus) !== -1) {
                return sStatus + " - Pending";
            }

            return sStatus;
        },

        _formatOrderStatusState: function (sStatus) {

            if (ORDER_STATUS_SUCCESS.indexOf(sStatus) !== -1) {
                return ValueState.Success;
            }
            if (ORDER_STATUS_FAILED.indexOf(sStatus) !== -1) {
                return ValueState.Warning;
            }
            if (ORDER_STATUS_REJECTED.indexOf(sStatus) !== -1) {
                return ValueState.Error;
            }
            if (ORDER_STATUS_PENDING.indexOf(sStatus) !== -1) {
                return ValueState.Information;
            }

            return ValueState.None;
        },

        _formatPercent: function (fValue) {
            return Number(fValue).toFixed(2) + "%";
        },

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

        _formatResponseTime: function (fValue) {
            return Number(fValue).toFixed(2) + " ms";
        }

    });

});