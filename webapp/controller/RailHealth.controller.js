sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("payment.dashboard.controller.RailHealth", {

        onInit: function () {

            var oModel = new sap.ui.model.json.JSONModel({

                filter: {

                    paymentDate: new Date(),

                    clearingArea: "DEBNKC"

                },

                kpis: {

                    overallHealth: "98.7%",

                    activeRails: "12 / 12",

                    transactions: "2.45M",

                    successRate: "99.92%",

                    failedPayments: "0.08%",

                    responseTime: "1.8 sec",

                    queueDepth: "245",

                    alerts: "2"

                },
                railOverview: [

                    {
                        rail: "SWIFT",
                        status: "Healthy",
                        success: "99.96%",
                        response: "2.3 sec",
                        volume: "245K"
                    },
                    {
                        rail: "SEPA",
                        status: "Healthy",
                        success: "99.94%",
                        response: "1.1 sec",
                        volume: "620K"
                    },
                    {
                        rail: "SEPA Instant",
                        status: "Warning",
                        success: "98.75%",
                        response: "7.0 sec",
                        volume: "185K"
                    },
                    {
                        rail: "RTP",
                        status: "Healthy",
                        success: "99.98%",
                        response: "0.8 sec",
                        volume: "92K"
                    },
                    {
                        rail: "ACH",
                        status: "Healthy",
                        success: "99.90%",
                        response: "2.8 sec",
                        volume: "810K"
                    },
                    {
                        rail: "RTGS",
                        status: "Healthy",
                        success: "99.99%",
                        response: "1.6 sec",
                        volume: "45K"
                    },
                    {
                        rail: "UPI",
                        status: "Critical",
                        success: "96.20%",
                        response: "11 sec",
                        volume: "320K"
                    }

                ]




            });

            this.getView().setModel(oModel, "railHealth");

        },



    });

});