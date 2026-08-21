sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/ui/export/Spreadsheet"
], function (Controller, JSONModel, MessageToast, Dialog, Spreadsheet) {
    "use strict";

    // ✅ Daily vs Hourly datasets for the Audit Trend chart. Same "day" field
    // name is reused for both so the existing dimension binding
    // (auditTrend>day) doesn't need to change when the granularity switches —
    // only the label text and the number of buckets differ.
    var AUDIT_TREND_DATA = {
        Day: [
            { day: "Mon", success: 120, failed: 12 },
            { day: "Tue", success: 150, failed: 18 },
            { day: "Wed", success: 180, failed: 20 },
            { day: "Thu", success: 165, failed: 15 },
            { day: "Fri", success: 210, failed: 25 },
            { day: "Sat", success: 90, failed: 8 },
            { day: "Sun", success: 110, failed: 10 }
        ],
        Hour: [
            { day: "00:00", success: 8, failed: 1 },
            { day: "02:00", success: 5, failed: 0 },
            { day: "04:00", success: 4, failed: 1 },
            { day: "06:00", success: 12, failed: 2 },
            { day: "08:00", success: 28, failed: 3 },
            { day: "10:00", success: 34, failed: 4 },
            { day: "12:00", success: 30, failed: 3 },
            { day: "14:00", success: 26, failed: 5 },
            { day: "16:00", success: 22, failed: 2 },
            { day: "18:00", success: 18, failed: 3 },
            { day: "20:00", success: 14, failed: 1 },
            { day: "22:00", success: 9, failed: 1 }
        ]
    };

    return Controller.extend("payment.dashboard.controller.Audit", {

        onInit: function () {

            // Audit Trend Chart Model
            var oTrend = new JSONModel({
                data: AUDIT_TREND_DATA.Day
            });

            this.getView().setModel(oTrend, "auditTrend");

            // Donut Chart Model
            var oSeverity = new JSONModel({
                data: [
                    { severity: "Critical", count: 24 },
                    { severity: "Warning", count: 52 },
                    { severity: "Information", count: 118 },
                    { severity: "Success", count: 860 }
                ]
            });

            this.getView().setModel(oSeverity, "auditSeverity");

            var oAuditTable = new JSONModel({

                data: [

                    {
                        time: "31-Jul-2026 09:15",
                        user: "SYSTEM",
                        action: "Payment Created",
                        object: "PO100001",
                        severity: "Information",
                        state: "Success",
                        status: "Completed"
                    },

                    {
                        time: "31-Jul-2026 09:22",
                        user: "ADMIN",
                        action: "Role Updated",
                        object: "USER001",
                        severity: "Warning",
                        state: "Warning",
                        status: "Completed"
                    },

                    {
                        time: "31-Jul-2026 09:40",
                        user: "SYSTEM",
                        action: "Payment Failed",
                        object: "PO100015",
                        severity: "Critical",
                        state: "Error",
                        status: "Failed"
                    },

                    {
                        time: "31-Jul-2026 10:05",
                        user: "AUDITOR",
                        action: "Manual Review",
                        object: "PO100020",
                        severity: "Information",
                        state: "Success",
                        status: "Reviewed"
                    }

                ]

            });

            this.getView().setModel(oAuditTable, "auditTable");

            // ✅ Top Event Types (bar panel — bottom-right, 40% column)
            var oEventTypes = new JSONModel({
                data: [
                    { type: "Payment Authorization", count: 742, percent: 30 },
                    { type: "Payment Execution", count: 531, percent: 22 },
                    { type: "Data Change", count: 412, percent: 17 },
                    { type: "System Access", count: 318, percent: 13 },
                    { type: "Other", count: 455, percent: 18 }
                ]
            });

            this.getView().setModel(oEventTypes, "auditEventTypes");

        },

        onTilePress: function () {
            MessageToast.show("Tile Pressed");
        },

        onViewAllAuditEvents: function () {
            MessageToast.show("View all audit events");
        },

        onViewAllEventTypes: function () {
            MessageToast.show("View all event types");
        },

        onAuditTableSettings: function () {
            MessageToast.show("Table settings");
        },

        // ==========================================================
        // 1. Audit Trend — Daily / Hourly dropdown
        // ==========================================================
        onAuditGranularityChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem").getKey();
            var aData = AUDIT_TREND_DATA[sKey] || AUDIT_TREND_DATA.Day;

            this.getView().getModel("auditTrend").setData({ data: aData });
        },

        // ==========================================================
        // 1. Audit Trend — Maximize / Restore (same pattern as the
        //    Overview page's onToggleChartSize)
        // ==========================================================
        onToggleAuditTrendSize: function () {

            var oCard = this.byId("_IDGenVBox7");
            var oButton = this.byId("auditTrendExpandButton");
            var oChart = this.byId("auditTrendChart");

            if (!this._oAuditTrendDialog) {

                this._oAuditTrendDialog = new Dialog({
                    contentWidth: "92%",
                    contentHeight: "85%",
                    stretch: false,
                    draggable: true,
                    resizable: true,
                    horizontalScrolling: false,
                    verticalScrolling: false
                });

                this.getView().addDependent(this._oAuditTrendDialog);

                this._oAuditTrendDialog.attachAfterClose(function () {

                    if (this._oOriginalAuditTrendParent) {

                        this._oOriginalAuditTrendParent.insertItem(
                            oCard,
                            this._iOriginalAuditTrendIndex
                        );

                        oCard.setWidth("60%");
                        oChart.setHeight("320px");

                        oButton.setIcon("sap-icon://full-screen");

                        this._bAuditTrendExpanded = false;
                    }

                }.bind(this));
            }

            if (!this._bAuditTrendExpanded) {

                this._oOriginalAuditTrendParent = oCard.getParent();

                this._iOriginalAuditTrendIndex =
                    this._oOriginalAuditTrendParent.indexOfItem(oCard);

                this._oOriginalAuditTrendParent.removeItem(oCard);

                this._oAuditTrendDialog.removeAllContent();

                oCard.setWidth("100%");
                oCard.setHeight("100%");

                oChart.setWidth("100%");
                oChart.setHeight("650px");

                this._oAuditTrendDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");

                this._bAuditTrendExpanded = true;

                this._oAuditTrendDialog.open();

            } else {

                oCard.setWidth("60%");
                oChart.setHeight("320px");

                this._oAuditTrendDialog.close();

            }

        },

        // ==========================================================
        // 3. Recent Audit Events — Export
        // ==========================================================
        onExportAuditEvents: function () {

            var oTable = this.byId("auditTable");
            var oBinding = oTable.getBinding("items");

            var aData = oBinding.getContexts().map(function (oContext) {
                return oContext.getObject();
            });

            var aColumns = [
                { label: "Time", property: "time", type: "string" },
                { label: "User", property: "user", type: "string" },
                { label: "Action", property: "action", type: "string" },
                { label: "Object", property: "object", type: "string" },
                { label: "Severity", property: "severity", type: "string" },
                { label: "Status", property: "status", type: "string" }
            ];

            var oSpreadsheet = new Spreadsheet({
                workbook: {
                    columns: aColumns
                },
                dataSource: aData,
                fileName: "Audit_Events.xlsx"
            });

            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });

        },

        // ==========================================================
        // 3. Recent Audit Events — Maximize / Restore
        // ==========================================================
        onToggleAuditTableSize: function () {

            var oCard = this.byId("_IDGenVBox144");
            var oButton = this.byId("auditTableExpandButton");

            if (!this._oAuditTableDialog) {

                this._oAuditTableDialog = new Dialog({
                    contentWidth: "92%",
                    contentHeight: "85%",
                    stretch: false,
                    draggable: true,
                    resizable: true,
                    horizontalScrolling: false,
                    verticalScrolling: true
                });

                this.getView().addDependent(this._oAuditTableDialog);

                this._oAuditTableDialog.attachAfterClose(function () {

                    if (this._oOriginalAuditTableParent) {

                        this._oOriginalAuditTableParent.insertItem(
                            oCard,
                            this._iOriginalAuditTableIndex
                        );

                        oCard.setWidth("60%");
                        oCard.setHeight("");

                        oButton.setIcon("sap-icon://full-screen");

                        this._bAuditTableExpanded = false;
                    }

                }.bind(this));
            }

            if (!this._bAuditTableExpanded) {

                this._oOriginalAuditTableParent = oCard.getParent();

                this._iOriginalAuditTableIndex =
                    this._oOriginalAuditTableParent.indexOfItem(oCard);

                this._oOriginalAuditTableParent.removeItem(oCard);

                this._oAuditTableDialog.removeAllContent();

                oCard.setWidth("100%");
                oCard.setHeight("100%");

                this._oAuditTableDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");

                this._bAuditTableExpanded = true;

                this._oAuditTableDialog.open();

            } else {

                oCard.setWidth("60%");
                this._oAuditTableDialog.close();

            }

        }

    });
});