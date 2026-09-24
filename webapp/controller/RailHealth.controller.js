sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("payment.dashboard.controller.RailHealth", {

        onInit: function () {

            var oModel = new JSONModel({

                filter: {
                    paymentDate: new Date(),
                    clearingArea: "DEBNKC"
                },

                kpis: {

                    overallHealth: "98.7%",
                    overallHealthSub: "All payment rails operational",

                    activeRails: "12 / 12",
                    activeRailsSub: "Active and monitored",

                    transactions: "2.45M",
                    transactionsSub: "Today's transactions",

                    successRate: "99.92%",
                    successRateSub: "Across all payment rails",

                    failedPayments: "0.08%",
                    failedPaymentsSub: "Of total transactions",

                    responseTime: "1.8 sec",
                    responseTimeSub: "Average response time",

                    queueDepth: "245",
                    queueDepthSub: "Transactions in queue",

                    alerts: "2",
                    alertsSub: "Require attention"
                },

                railOverview: [

                    {
                        rail: "SWIFT",
                        status: "Healthy",
                        successRate: "99.96%",
                        responseTime: "2.3 sec",
                        volume: "245K"
                    },

                    {
                        rail: "SEPA",
                        status: "Healthy",
                        successRate: "99.94%",
                        responseTime: "1.1 sec",
                        volume: "620K"
                    },

                    {
                        rail: "SEPA Instant",
                        status: "Warning",
                        successRate: "98.75%",
                        responseTime: "7.0 sec",
                        volume: "185K"
                    },

                    {
                        rail: "RTP",
                        status: "Healthy",
                        successRate: "99.98%",
                        responseTime: "0.8 sec",
                        volume: "92K"
                    },

                    {
                        rail: "ACH",
                        status: "Healthy",
                        successRate: "99.90%",
                        responseTime: "2.8 sec",
                        volume: "810K"
                    },

                    {
                        rail: "RTGS",
                        status: "Healthy",
                        successRate: "99.99%",
                        responseTime: "1.6 sec",
                        volume: "45K"
                    },

                    {
                        rail: "UPI",
                        status: "Critical",
                        successRate: "96.20%",
                        responseTime: "11 sec",
                        volume: "320K"
                    }

                ]

            });

            this.getView().setModel(oModel, "railHealth");
        }

    });

});