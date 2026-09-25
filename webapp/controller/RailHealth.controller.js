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

                    activeRails: "12 / 12",
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

            // First call will likely no-op — parent View1's filterModel isn't
            // created yet at this point in the lifecycle. Real load happens
            // via onFilterChange(), called from View1._refreshRailHealth().
        },

        onFilterChange: function () {

            var oFilterModel = this.getView().getModel("filterModel");

            if (!oFilterModel) {
                console.error("Rail Health: filterModel not found");
                return;
            }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sDate = oFilterModel.getProperty("/kpiDate");

            console.log("Rail Health filter changed:", sClearingArea, sDate);

            this._loadRailHealthKpis(sClearingArea, sDate);
        },

        // ============================================================
        // LOAD KPI DATA
        // ============================================================

        _loadRailHealthKpis: function (sClearingArea, sDate) {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oRailModel = this.getView().getModel("railHealth");

            if (!oODataModel) {
                console.error("Rail Health: OData model not found");
                return;
            }

            if (!oRailModel) {
                console.error("Rail Health: railHealth model not found");
                return;
            }

            console.log("=================================");
            console.log("Rail Health OData load");
            console.log("Clearing Area:", sClearingArea);
            console.log("Date:", sDate);
            console.log("=================================");

            if (!sClearingArea || !sDate) {
                console.warn("Rail Health: missing filter values");
                this._setEmptyRailKpis();
                return;
            }

            var sFormattedDate = this._formatDateForOData(sDate);

            // ✅ CORRECTED: this is the entity that actually carries
            // Transactions / ResponseTime / CriticalAlerts — confirmed
            // against a direct fetch of /RailItemKpi. /RailKpi (used
            // elsewhere in this app for the rail-status donut) does NOT
            // have these fields and was the wrong entity to point at.
            var aFilters = [
                new Filter("clearing_area", FilterOperator.EQ, sClearingArea),
                new Filter("crdat", FilterOperator.EQ, sFormattedDate)
            ];

            var oListBinding = oODataModel.bindList(
                "/RailItemKpi",
                null,
                null,
                aFilters
            );

            oListBinding
                .requestContexts(0, 1000)
                .then(function (aContexts) {

                    var aData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });

                    console.log("Rail Health OData records:", aData);

                    if (!aData.length) {
                        console.warn("No RailItemKpi data found for:", sClearingArea, sFormattedDate);
                        this._setEmptyRailKpis();
                        return;
                    }

                    // Confirm exact match defensively — the OData filter
                    // should already narrow this, but be explicit.
                    var oData = aData.find(function (oItem) {
                        return (
                            String(oItem.clearing_area) === String(sClearingArea) &&
                            this._normaliseDate(oItem.crdat) === sFormattedDate
                        );
                    }.bind(this)) || aData[0];

                    console.log("Rail Health selected OData record:", oData);

                    this._updateRailKpis(oData);

                }.bind(this))
                .catch(function (oError) {
                    console.error(
                        "Rail Health OData load failed:",
                        oError && (oError.message || oError)
                    );
                    this._setEmptyRailKpis();
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

            console.log("RAIL KPI RAW JSON >>> " + JSON.stringify(oItem));

            // ✅ These field names are now confirmed correct against the
            // real /RailItemKpi payload (document 8): Transactions,
            // ResponseTime, CriticalAlerts — all present, all PascalCase.
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

        // ============================================================
        // EMPTY STATE
        // ============================================================

        _setEmptyRailKpis: function () {

            var oModel = this.getView().getModel("railHealth");

            if (!oModel) {
                return;
            }

            oModel.setProperty("/kpis/transactions", "0");
            oModel.setProperty("/kpis/transactionsSub", "No data for this filter");

            oModel.setProperty("/kpis/responseTime", "0 ms");
            oModel.setProperty("/kpis/responseTimeSub", "No data for this filter");

            oModel.setProperty("/kpis/alerts", "0");
            oModel.setProperty("/kpis/alertsSub", "No data for this filter");
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

        // ============================================================
        // RESPONSE TIME FORMAT
        // ============================================================

        _formatResponseTime: function (fValue) {
            return Number(fValue).toFixed(2) + " ms";
        }

    });

});