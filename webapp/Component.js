sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "payment/dashboard/model/models",
    "sap/ui/model/odata/v4/ODataModel"
], function (UIComponent, Device, models, ODataModel) {
    "use strict";

    return UIComponent.extend("payment.dashboard.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            var omodel = new ODataModel({
                serviceUrl: "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/",
                operationMode: "Server",
                autoExpandSelect: true,
                groupId: "$auto",
            });

            this.setModel(omodel);
        }
    });
});