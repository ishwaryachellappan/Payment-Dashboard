sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/core/Theming",
    "sap/ui/Device",
    "payment/dashboard/model/models",
    "sap/ui/model/odata/v4/ODataModel"
], function (UIComponent, Theming, Device, models, ODataModel) {
    "use strict";

    return UIComponent.extend("payment.dashboard.Component", {

        metadata: {
            manifest: "json"
        
        },

        init: function () {

            console.log("========== PAYMENT COMPONENT INIT ==========");
            console.log("Component ID:", this.getId());

            UIComponent.prototype.init.apply(this, arguments);

            console.log("========== COMPONENT BASE INIT DONE ==========");

            // Stop Chrome from auto-translating the app
            document.documentElement.setAttribute("translate", "no");
            document.documentElement.setAttribute("lang", sap.ui.getCore().getConfiguration().getLanguage());

            var oModel = new ODataModel({
                serviceUrl: "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/",
                operationMode: "Server",
                autoExpandSelect: true,
                groupId: "$auto"
            });

            this.setModel(oModel);

            console.log("========== BEFORE ROUTER INITIALIZE ==========");

            // Force light theme for this dashboard
            if (Theming.getTheme() !== "sap_horizon") {
                Theming.setTheme("sap_horizon");
            }

            this.getRouter().initialize();

            console.log("========== AFTER ROUTER INITIALIZE ==========");
        }
    });
});