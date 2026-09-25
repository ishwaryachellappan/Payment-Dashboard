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

        onInit: function () {

            var oRailHealthModel = new JSONModel({

                kpis: {
                    overallHealth: "98.7%",
                    overallHealthSub: "Overall rail health",

                    activeRails: "0 / 0",
                    activeRailsSub: "Active and monitored",

                    transactions: "0",
                    transactionsSub: "Total transactions",

                    successRate: "99.92%",
                    successRateSub: "Across all payment rails",

                    failedPayments: "0.08%",
                    failedPaymentsSub: "Of total transactions",

                    responseTime: "0 ms",
                    responseTimeSub: "Average response time",

                    queueDepth: "245",
                    queueDepthSub: "Transactions in queue",

                    alerts: "0",
                    alertsSub: "No critical alerts"
                },

                railOverview: [
                    { rail: "SWIFT", status: "Healthy", successRate: "99.96%", responseTime: "2.3 sec", volume: "245K" },
                    { rail: "SEPA", status: "Healthy", successRate: "99.94%", responseTime: "1.1 sec", volume: "620K" },
                    { rail: "SEPA Instant", status: "Warning", successRate: "98.75%", responseTime: "7.0 sec", volume: "185K" },
                    { rail: "RTP", status: "Healthy", successRate: "99.98%", responseTime: "0.8 sec", volume: "92K" },
                    { rail: "ACH", status: "Healthy", successRate: "99.90%", responseTime: "2.8 sec", volume: "810K" },
                    { rail: "RTGS", status: "Healthy", successRate: "99.99%", responseTime: "1.6 sec", volume: "45K" },
                    { rail: "UPI", status: "Critical", successRate: "96.20%", responseTime: "11 sec", volume: "320K" }
                ]

            });

            this.getView().setModel(oRailHealthModel, "railHealth");

            // ❌ Do NOT try to load here. This nested view's onInit runs
            // eagerly as part of View1's own control-tree construction —
            // BEFORE View1.onInit() has run — so filterModel is guaranteed
            // not to exist yet at this point, no matter what.
        },

        // ✅ FIX: onAfterRendering fires once the view is actually painted
        // to the DOM, which happens only after the whole component tree —
        // including View1.onInit() — has finished. filterModel reliably
        // exists by now. Guarded with _bInitialLoadDone so it only fires
        // the first time, since onAfterRendering can fire again later
        // (e.g. re-render after data binding changes).
        onAfterRendering: function () {

            if (this._bInitialLoadDone) {
                return;
            }

            var oFilterModel = this.getView().getModel("filterModel");

            if (!oFilterModel) {
                // Still not ready — extremely unlikely at this point, but
                // don't set the guard flag so a later render can retry.
                console.warn("Rail Health: filterModel still not found at onAfterRendering");
                return;
            }

            this._bInitialLoadDone = true;

            console.log("Rail Health: initial load via onAfterRendering");

            this.onFilterChange();
        },

        onFilterChange: function () {

            var oFilterModel = this.getView().getModel("filterModel");

            if (!oFilterModel) {
                console.warn("Rail Health: filterModel not found yet — will load on next refresh");
                return;
            }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sDate = oFilterModel.getProperty("/kpiDate");

            console.log("Rail Health filter changed:", sClearingArea, sDate);

            this._loadRailHealthKpis(sClearingArea, sDate);
            this._loadActiveRailKpi(sClearingArea, sDate);
        },

        // ============================================================
        // LOAD KPI DATA — Transactions / Response Time / Critical Alerts
        // ============================================================

        _loadRailHealthKpis: function (sClearingArea, sDate) {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oRailModel = this.getView().getModel("railHealth");

            if (!oODataModel || !oRailModel) {
                return;
            }

            if (!sClearingArea || !sDate) {
                console.warn("Rail Health: missing filter values");
                this._setEmptyRailKpis();
                return;
            }

            var sFormattedDate = this._formatDateForOData(sDate);

            var aFilters = [
                new Filter("clearing_area", FilterOperator.EQ, sClearingArea),
                new Filter("crdat", FilterOperator.EQ, sFormattedDate)
            ];

            var oListBinding = oODataModel.bindList("/RailItemKpi", null, null, aFilters);

            oListBinding
                .requestContexts(0, 1000)
                .then(function (aContexts) {

                    var aData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });

                    if (!aData.length) {
                        console.warn("No RailItemKpi data found for:", sClearingArea, sFormattedDate);
                        this._setEmptyRailKpis();
                        return;
                    }

                    var oData = aData.find(function (oItem) {
                        return (
                            String(oItem.clearing_area) === String(sClearingArea) &&
                            this._normaliseDate(oItem.crdat) === sFormattedDate
                        );
                    }.bind(this)) || aData[0];

                    this._updateRailKpis(oData);

                }.bind(this))
                .catch(function (oError) {
                    console.error("Rail Health RailItemKpi load failed:", oError && (oError.message || oError));
                    this._setEmptyRailKpis();
                }.bind(this));
        },

        // ============================================================
        // LOAD KPI DATA — Active Rails / Total Rails
        // ============================================================

        _loadActiveRailKpi: function (sClearingArea, sDate) {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oRailModel = this.getView().getModel("railHealth");

            if (!oODataModel || !oRailModel) {
                return;
            }

            if (!sClearingArea || !sDate) {
                this._setEmptyActiveRailsKpi();
                return;
            }

            var sFormattedDate = this._formatDateForOData(sDate);

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("CreatedOn", FilterOperator.EQ, sFormattedDate)
            ];

            var oListBinding = oODataModel.bindList("/ActiveRailKpi", null, null, aFilters);

            oListBinding
                .requestContexts(0, 1000)
                .then(function (aContexts) {

                    var aData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });

                    if (!aData.length) {
                        console.warn("No ActiveRailKpi data found for:", sClearingArea, sFormattedDate);
                        this._setEmptyActiveRailsKpi();
                        return;
                    }

                    var oData = aData.find(function (oItem) {
                        return (
                            String(oItem.ClearingArea) === String(sClearingArea) &&
                            this._normaliseDate(oItem.CreatedOn) === sFormattedDate
                        );
                    }.bind(this)) || aData[0];

                    this._updateActiveRailsKpi(oData);

                }.bind(this))
                .catch(function (oError) {
                    console.error("Rail Health ActiveRailKpi load failed:", oError && (oError.message || oError));
                    this._setEmptyActiveRailsKpi();
                }.bind(this));
        },

        // ============================================================
        // UPDATE KPI VALUES
        // ============================================================

        _updateRailKpis: function (oItem) {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel || !oItem) {
                return;
            }

            var iTransactions = Number(oItem.Transactions || 0);
            var fResponseTime = Number(oItem.ResponseTime || 0);
            var iCriticalAlerts = Number(oItem.CriticalAlerts || 0);

            oModel.setProperty("/kpis/transactions", this._formatNumber(iTransactions));
            oModel.setProperty("/kpis/responseTime", this._formatResponseTime(fResponseTime));
            oModel.setProperty("/kpis/alerts", String(iCriticalAlerts));

            oModel.setProperty("/kpis/transactionsSub", "Total transactions");
            oModel.setProperty("/kpis/responseTimeSub", "Average response time");
            oModel.setProperty(
                "/kpis/alertsSub",
                iCriticalAlerts > 0 ? "Require attention" : "No critical alerts"
            );
        },

        _updateActiveRailsKpi: function (oItem) {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel || !oItem) {
                return;
            }

            var iActive = Number(oItem.ActiveRailCount || 0);
            var iTotal = Number(oItem.TotalRailCount || 0);

            oModel.setProperty("/kpis/activeRails", iActive + " / " + iTotal);

            oModel.setProperty(
                "/kpis/activeRailsSub",
                iTotal > 0 && iActive < iTotal ? "Some rails inactive" : "Active and monitored"
            );
        },

        // ============================================================
        // EMPTY STATES
        // ============================================================

        _setEmptyRailKpis: function () {

            var oModel = this.getView().getModel("railHealth");
            if (!oModel) { return; }

            oModel.setProperty("/kpis/transactions", "0");
            oModel.setProperty("/kpis/transactionsSub", "No data for this filter");
            oModel.setProperty("/kpis/responseTime", "0 ms");
            oModel.setProperty("/kpis/responseTimeSub", "No data for this filter");
            oModel.setProperty("/kpis/alerts", "0");
            oModel.setProperty("/kpis/alertsSub", "No data for this filter");
        },

        _setEmptyActiveRailsKpi: function () {

            var oModel = this.getView().getModel("railHealth");
            if (!oModel) { return; }

            oModel.setProperty("/kpis/activeRails", "0 / 0");
            oModel.setProperty("/kpis/activeRailsSub", "No data for this filter");
        },

        // ============================================================
        // DATE FORMAT
        // ============================================================

        _formatDateForOData: function (vDate) {

            if (!vDate) { return null; }

            if (typeof vDate === "string") {
                return vDate.substring(0, 10);
            }

            if (vDate instanceof Date) {
                var iYear = vDate.getFullYear();
                var iMonth = vDate.getMonth() + 1;
                var iDay = vDate.getDate();

                return iYear + "-" + String(iMonth).padStart(2, "0") + "-" + String(iDay).padStart(2, "0");
            }

            return null;
        },

        _normaliseDate: function (vDate) {

            if (!vDate) { return null; }

            if (vDate instanceof Date) {
                return this._formatDateForOData(vDate);
            }

            return String(vDate).substring(0, 10);
        },

        // ============================================================
        // NUMBER FORMAT
        // ============================================================

        _formatNumber: function (iValue) {

            if (iValue >= 1000000) {
                return (iValue / 1000000).toFixed(2) + "M";
            }

            if (iValue >= 1000) {
                return (iValue / 1000).toFixed(1) + "K";
            }

            return String(iValue);
        },

        _formatResponseTime: function (fValue) {
            return Number(fValue).toFixed(2) + " ms";
        }

    });

});