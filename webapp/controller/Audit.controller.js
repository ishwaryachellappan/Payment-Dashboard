sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Button",
    "sap/m/ObjectStatus",
    "sap/m/HBox",
    "sap/ui/core/Icon",
    "sap/ui/export/Spreadsheet"
], function (
    Controller,
    JSONModel,
    MessageToast,
    Column,
    ColumnListItem,
    Text,
    Button,
    ObjectStatus,
    HBox,
    Icon,
    Spreadsheet
) {
    "use strict";

    // Keep your existing Controller.extend(...) implementation here.

    // ✅ Same field catalog as Overview's PAYMENT_INFO_FIELD_CATALOG
    // (payment.dashboard.controller.View1) — kept here as its own copy since
    // controllers don't share module state, but the keys/labels/types must
    // stay identical so this really is "the exact table from Overview".
    // Swap this for a shared module export later if you want one source of truth.
    var PAYMENT_INFO_FIELD_CATALOG = [
        { key: "OrderKey", label: "Order Key", width: "13rem" },
        { key: "TechnicalStatus", label: "Technical Status", width: "10rem" },
        { key: "CreatedOn", label: "Created On", type: "date", width: "9rem" },
        { key: "LastChangedBy", label: "Last Changed By", width: "10rem" },
        { key: "CreatedBy", label: "Created By", width: "9rem" },
        { key: "ReleasedBy", label: "Released By", width: "9rem" },
        { key: "OrderFormat", label: "Order Format", width: "9rem" },
        { key: "Medium", label: "Medium", width: "8rem" },
        { key: "Channel", label: "Channel", width: "8rem" },
        { key: "ClearingArea", label: "Clearing Area", width: "9rem" },
        { key: "PaymentOrderNumber", label: "Payment Order Number", width: "11rem" },
        { key: "PaymentOrderDate", label: "Payment Order Date", type: "date", width: "10rem" },
        { key: "PaymentOrderStatus", label: "Payment Order Status", width: "10rem" },
        { key: "PaymentOrderType", label: "Payment Order Type", width: "10rem" },
        { key: "PreviousStatus", label: "Previous Status", width: "9rem" },
        { key: "PlannedExecutionDate", label: "Planned Execution Date", type: "date", width: "11rem" },
        { key: "ExternalSenderBIC", label: "External Sender BIC", width: "10rem" },
        { key: "RecipientBIC", label: "Recipient BIC", width: "9rem" },
        { key: "RecipientName", label: "Recipient Name", width: "11rem" },
        { key: "ClearingBIC", label: "Clearing BIC", width: "9rem" },
        { key: "ExternalOrderNumber", label: "External Order Number", width: "11rem" },
        { key: "ObjectListDate", label: "Object List Date", type: "date", width: "9rem" },
        { key: "ObjectListNumber", label: "Object List Number", width: "10rem" }
    ];






    var PAGE_SIZE = 10;

    return Controller.extend("payment.dashboard.controller.Audit", {

        onInit: function () {

            this.getView().setModel(new JSONModel({ mode: "list" }), "auditViewState");

            this.getView().setModel(new JSONModel({
                all: [],
                filtered: [],
                pageItems: [],
                total: 0,
                currentPage: 1,
                totalPages: 1,
                pageButtons: [],
                selectedPaymentId: ""
            }), "auditPayments");

            this.getView().setModel(new JSONModel(this._getMockDetail()), "auditDetail");
            this.getView().setModel(new JSONModel({ steps: this._getMockTimeline() }), "auditTimeline");
            this.getView().setModel(new JSONModel({ data: this._getMockEvents() }), "auditEventsTable");
            this.getView().setModel(new JSONModel({ visible: false }), "auditEventDetail");
        },



        onAfterRendering: function () {
            if (!this._bAuditTableBuilt) {
                this._rebuildAuditFullPaymentsTable();   // renamed — only builds the full-catalog table
                this._bAuditTableBuilt = true;
            }
        },

        _rebuildAuditFullPaymentsTable: function () {

            var oTable = this.byId("auditPaymentsFullTable");
            if (!oTable) {
                return;
            }

            var that = this;

            oTable.destroyColumns();
            oTable.unbindItems();

            oTable.addColumn(new Column({ width: "3rem" }));

            PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {
                oTable.addColumn(new Column({
                    width: oFieldDef.width || "10rem",
                    header: new Text({ text: oFieldDef.label })
                }));
            });

            oTable.bindItems({
                path: "auditPayments>/pageItems",
                factory: function () {

                    var aCells = [
                        new Button({
                            icon: "sap-icon://navigation-right-arrow",
                            type: "Transparent",
                            press: that.onFullTableRowPress.bind(that)
                        })
                    ];

                    PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {
                        aCells.push(that._buildFieldCell(oFieldDef));
                    });

                    return new ColumnListItem({
                        type: "Navigation",
                        press: that.onFullTableRowPress.bind(that),
                        cells: aCells
                    });
                }
            });
        },


// Called by View1.controller.js's _refreshAudit() every time Overview's
// own PaymentInfo read finishes — Clearing Area, Posting Date, or Created
// On change, variant load, or initial page load. aRows is the EXACT array
// Overview's own Payment Transactions table is bound to
// (paymentTable>/PaymentInfo) — not a copy, not re-filtered here. Whatever
// Overview shows, Audit shows, by construction.
setPaymentData: function (aRows) {

    var that = this;

    var aMapped = (aRows || []).map(function (oRow) {

        var oStatus = that._classifyTechnicalStatus(String(oRow.TechnicalStatus || ""));

        return Object.assign({}, oRow, {
            PaymentId: "PAY-" + (oRow.PaymentOrderNumber || oRow.OrderKey || ""),
            Status: oStatus.label,
            StatusState: oStatus.state,
            StatusColor: oStatus.color
        });
    });

    var oPaymentsModel = this.getView().getModel("auditPayments");

    oPaymentsModel.setProperty("/all", aMapped);
    oPaymentsModel.setProperty("/filtered", aMapped);
    oPaymentsModel.setProperty("/total", aMapped.length);
    oPaymentsModel.setProperty("/totalPages", Math.max(1, Math.ceil(aMapped.length / PAGE_SIZE)));
    oPaymentsModel.setProperty("/currentPage", 1);

    this._applyPaymentsPage();
},


        // Builds 2-4 rows that exactly match the given filter values, so Audit
        // never shows a hard zero for a date/Clearing Area the 125-row mock pool
        // doesn't happen to cover. Remove alongside _applyGlobalFilters' fallback
        // block once real OData is wired in.

        // Mirrors Overview's formatOrderTechnicalStatusText / formatTechnicalStatusState
        // code mapping, collapsed into the plain labels the reference image uses.
        _classifyTechnicalStatus: function (sCode) {
            switch (sCode) {
                case "128":
                case "130":
                case "230":
                    return { label: "Posted", state: "Success", color: "#0ca30c" };
                case "170":
                    return { label: "Failed", state: "Error", color: "#d03b3b" };
                case "172":
                case "173":
                    return { label: "Unmatched", state: "Error", color: "#d03b3b" };
                default:
                    return { label: "Pending", state: "Warning", color: "#fab219" };
            }
        },

        _getMockDetail: function () {
            return {
                PaymentId: "PAY-100245",
                OrderKey: "ORD/245",
                Status: "Posted",
                StatusPillClass: "statusPillGreen",
                Amount: "EUR 10,000.00",
                PaymentReference: "REF123456789",
                EndToEndId: "E2E987654321",
                ReceivedOn: "01.12.2024, 09:00:01",
                PostedOn: "01.12.2024, 09:00:07",
                ReconciliationStatus: "Matched",
                ReconciliationPillClass: "statusPillGreen"
            };
        },

        _getMockTimeline: function () {
            return [
                { key: "received", label: "Received", time: "09:00:01", system: "Payment Centralization", icon: "sap-icon://document-text", colorKey: "Green", nodeClass: "auditTimelineIconCircle auditTimelineIconGreen" },
                { key: "validated", label: "Validated", time: "09:00:02", system: "Validation Service", icon: "sap-icon://accept", colorKey: "Green", nodeClass: "auditTimelineIconCircle auditTimelineIconGreen" },
                { key: "routed", label: "Routed", time: "09:00:03", system: "Routing Control", icon: "sap-icon://share-2", colorKey: "Green", nodeClass: "auditTimelineIconCircle auditTimelineIconGreen" },
                { key: "posting", label: "Posting initiated", time: "09:00:05", system: "PC → Deposit Management", icon: "sap-icon://arrow-right", colorKey: "Blue", nodeClass: "auditTimelineIconCircle auditTimelineIconBlue" },
                { key: "posted", label: "Posted", time: "09:00:07", system: "SAP Deposit Management", icon: "sap-icon://database", colorKey: "Green", nodeClass: "auditTimelineIconCircle auditTimelineIconGreen" },
                { key: "reconciled", label: "Reconciled", time: "09:00:08", system: "Reconciliation Service", icon: "sap-icon://accept", colorKey: "Green", nodeClass: "auditTimelineIconCircle auditTimelineIconGreen", isLast: true }
            ];
        },

        _getMockEvents: function () {
            return [
                { Timestamp: "01.12.2024, 09:00:01", Event: "Payment received", System: "Payment Centralization", PreviousStatus: "-", NewStatus: "Received", Result: "Success", UserService: "PC_IFLOW", MessageId: "MSG000123456", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" },
                { Timestamp: "01.12.2024, 09:00:02", Event: "Validation completed", System: "Payment Centralization", PreviousStatus: "Received", NewStatus: "Validated", Result: "Success", UserService: "PC_VALIDATION", MessageId: "MSG000123457", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" },
                { Timestamp: "01.12.2024, 09:00:03", Event: "Routing completed", System: "Payment Centralization", PreviousStatus: "Validated", NewStatus: "Routed", Result: "Success", UserService: "PC_ROUTING", MessageId: "MSG000123458", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" },
                { Timestamp: "01.12.2024, 09:00:05", Event: "Posting request submitted", System: "PC → Deposit Management", PreviousStatus: "Routed", NewStatus: "Posting", Result: "Success", UserService: "PC_POSTING", MessageId: "MSG000123459", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" },
                { Timestamp: "01.12.2024, 09:00:07", Event: "Posting confirmed", System: "SAP Deposit Management", PreviousStatus: "Posting", NewStatus: "Posted", Result: "Success", UserService: "DM_POSTING", MessageId: "MSG000123460", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" },
                { Timestamp: "01.12.2024, 09:00:08", Event: "Reconciliation completed", System: "Reconciliation Service", PreviousStatus: "Posted", NewStatus: "Matched", Result: "Success", UserService: "RECON_SERVICE", MessageId: "MSG000123461", CorrelationId: "CORR-ABC-123456", IsoMessageType: "pain.001.001.09", ErrorCode: "-", ErrorDescription: "-" }
            ];
        },

        // Same pattern as formatKpiTrendClass — class expressions bound directly
        // via class="{= ...}" don't reliably apply in this codebase (see the
        // progress-bar fix note in the CSS file); routing through a formatter
        // that returns the plain class string does.
        formatTimelineNodeClass: function (sColorKey) {
            return "auditTimelineIconCircle " +
                (sColorKey === "Blue" ? "auditTimelineIconBlue" : "auditTimelineIconGreen");
        },

        // ==========================================================
        // TABLE BUILD — one physical Table, two shapes
        // ==========================================================

        // mode "list": full PAYMENT_INFO_FIELD_CATALOG + nav arrow, row press
        // opens detail mode. mode "detail": just Payment ID + Status, row
        // press re-selects which payment the middle/right panels show.
        _rebuildAuditPaymentsTable: function () {

            var oTable = this.byId("auditPaymentsTable");
            if (!oTable) {
                return;
            }

            var sMode = this.getView().getModel("auditViewState").getProperty("/mode");
            var that = this;

            oTable.destroyColumns();
            oTable.unbindItems();

            if (sMode === "list") {

                oTable.addColumn(new Column({ width: "3rem" }));

                PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {
                    oTable.addColumn(new Column({
                        width: oFieldDef.width || "10rem",
                        header: new Text({ text: oFieldDef.label })
                    }));
                });

                oTable.bindItems({
                    path: "auditPayments>/pageItems",
                    factory: function () {

                        var aCells = [
                            new Button({
                                icon: "sap-icon://navigation-right-arrow",
                                type: "Transparent",
                                press: that.onFullTableRowPress.bind(that)
                            })
                        ];

                        PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {
                            aCells.push(that._buildFieldCell(oFieldDef));
                        });

                        return new ColumnListItem({
                            type: "Navigation",
                            press: that.onFullTableRowPress.bind(that),
                            cells: aCells
                        });
                    }
                });

            } else {

                oTable.addColumn(new Column({ header: new Text({ text: "Payment ID" }) }));
                oTable.addColumn(new Column({ hAlign: "Begin", header: new Text({ text: "Status" }) }));

                oTable.bindItems({
                    path: "auditPayments>/pageItems",
                    factory: function () {
                        return new ColumnListItem({
                            type: "Active",
                            press: that.onPaymentRowPress.bind(that),
                            cells: [
                                new Text({
                                    text: "{auditPayments>PaymentId}",
                                    class: function () { return "auditPayIdText"; }()
                                }),
                                new HBox({
                                    alignItems: "Center",
                                    items: [
                                        new Icon({
                                            src: "sap-icon://circle-task",
                                            color: "{auditPayments>StatusColor}",
                                            class: "donutLegendDot sapUiTinyMarginEnd"
                                        }),
                                        new Text({ text: "{auditPayments>Status}" })
                                    ]
                                })
                            ]
                        });
                    }
                });
            }
        },

        _buildFieldCell: function (oFieldDef) {

            if (oFieldDef.type === "date") {
                return new Text({
                    text: {
                        path: "auditPayments>" + oFieldDef.key,
                        type: "sap.ui.model.type.Date",
                        formatOptions: { source: { pattern: "yyyy-MM-dd" }, style: "medium" }
                    }
                });
            }

            if (oFieldDef.key === "TechnicalStatus") {
                return new ObjectStatus({
                    text: { path: "auditPayments>TechnicalStatus", formatter: this.formatOrderTechnicalStatusText },
                    state: { path: "auditPayments>TechnicalStatus", formatter: this.formatTechnicalStatusState }
                });
            }

            return new Text({ text: "{auditPayments>" + oFieldDef.key + "}" });
        },

        // Same code mapping as Overview's formatOrderTechnicalStatusText/
        // formatTechnicalStatusState — kept identical so the pill looks the
        // same here as it does in the Overview table.
        formatOrderTechnicalStatusText: function (sStatus) {
            switch (sStatus) {
                case "128": case "130": case "230": case "270":
                    return sStatus + " - Successful";
                case "170":
                    return sStatus + " - Failed";
                case "172": case "173":
                    return sStatus + " - Rejected";
                default:
                    return sStatus + " - Pending";
            }
        },

        formatTechnicalStatusState: function (sStatus) {
            switch (sStatus) {
                case "128": case "130": case "230":
                    return sap.ui.core.ValueState.Success;
                case "170":
                    return sap.ui.core.ValueState.Warning;
                case "172": case "173":
                    return sap.ui.core.ValueState.Error;
                default:
                    return sap.ui.core.ValueState.Information;
            }
        },

        // ==========================================================
        // MODE SWITCHING
        // ==========================================================

        // First row click on the full catalog table — shrink to the 2-column
        // master list and reveal the detail/timeline/events panels.
        onFullTableRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext
                ? oEvent.getSource().getBindingContext("auditPayments")
                : null;

            if (!oContext) {
                oContext = oEvent.getParameter("listItem")
                    ? oEvent.getParameter("listItem").getBindingContext("auditPayments")
                    : null;
            }
            if (!oContext) {
                return;
            }

            this.getView().getModel("auditViewState").setProperty("/mode", "detail");
            this._selectPayment(oContext.getObject());
        },

        onBackToPaymentsList: function () {
            this.getView().getModel("auditViewState").setProperty("/mode", "list");
            this.getView().getModel("auditEventDetail").setProperty("/visible", false);
        },

        _statusToPillClass: function (sStatus) {
            switch (sStatus) {
                case "Posted":
                case "Matched":
                    return "statusPillGreen";
                case "Pending":
                    return "statusPillAmber";
                case "Failed":
                case "Unmatched":
                    return "statusPillRed";
                default:
                    return "statusPillBlue";
            }
        },

        // Row click on the narrow 2-column list while already in detail mode —
        // just re-selects which payment the middle/right panels reflect.
        onPaymentRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("auditPayments")
                || (oEvent.getParameter("listItem") && oEvent.getParameter("listItem").getBindingContext("auditPayments"));

            if (!oContext) {
                return;
            }

            this._selectPayment(oContext.getObject());
        },

        onBackToPaymentsList: function () {
            this.getView().getModel("auditViewState").setProperty("/mode", "list");
            this.getView().getModel("auditEventDetail").setProperty("/visible", false);
            this._rebuildAuditPaymentsTable();
        },

        // Updates the selection highlight + the detail header fields.
        // Timeline/events stay the generic static set until the audit OData
        // entity exists — only the header (PaymentId/Status/OrderKey/Amount)
        // reflects the clicked row for now.
        _selectPayment: function (oRow) {

            var oPaymentsModel = this.getView().getModel("auditPayments");
            oPaymentsModel.setProperty("/selectedPaymentId", oRow.PaymentId);

            var oDetailModel = this.getView().getModel("auditDetail");
            var oDetail = oDetailModel.getData();

            oDetailModel.setData(Object.assign({}, oDetail, {
                PaymentId: oRow.PaymentId,
                OrderKey: oRow.OrderKey,
                Status: oRow.Status,
                StatusPillClass: this._statusToPillClass(oRow.Status),
                ReconciliationStatus: oDetail.ReconciliationStatus || "Matched",
                ReconciliationPillClass: this._statusToPillClass(oDetail.ReconciliationStatus || "Matched"),
                PaymentReference: "REF" + oRow.PaymentOrderNumber + "000",
                EndToEndId: "E2E" + oRow.ExternalOrderNumber
            }));

            this.getView().getModel("auditEventDetail").setProperty("/visible", false);
        },

        // ==========================================================
        // PAYMENTS LIST — search + pagination (used in both modes)
        // ==========================================================

        onSearchPayments: function (oEvent) {
            var sQuery = (oEvent.getParameter("newValue") || "").trim().toLowerCase();
            var oModel = this.getView().getModel("auditPayments");
            var aAll = oModel.getProperty("/all");

            var aFiltered = !sQuery ? aAll : aAll.filter(function (oRow) {
                return oRow.PaymentId.toLowerCase().indexOf(sQuery) > -1 ||
                    oRow.OrderKey.toLowerCase().indexOf(sQuery) > -1 ||
                    (oRow.RecipientName || "").toLowerCase().indexOf(sQuery) > -1;
            });

            oModel.setProperty("/filtered", aFiltered);
            oModel.setProperty("/total", aFiltered.length);
            oModel.setProperty("/totalPages", Math.max(1, Math.ceil(aFiltered.length / PAGE_SIZE)));
            oModel.setProperty("/currentPage", 1);

            this._applyPaymentsPage();


        },

      onRefreshPaymentsList: function () {
    var oModel = this.getView().getModel("auditPayments");
    var aAll = oModel.getProperty("/all");

    oModel.setProperty("/filtered", aAll);
    oModel.setProperty("/total", aAll.length);
    oModel.setProperty("/totalPages", Math.max(1, Math.ceil(aAll.length / PAGE_SIZE)));
    oModel.setProperty("/currentPage", 1);

    this._applyPaymentsPage();
    MessageToast.show("Synced with Overview's current filters");
},

        onOpenPaymentsFilter: function () {
            MessageToast.show("Filter — coming soon");
        },

        onPagerPrev: function () {
            var oModel = this.getView().getModel("auditPayments");
            var iPage = oModel.getProperty("/currentPage");
            if (iPage > 1) {
                oModel.setProperty("/currentPage", iPage - 1);
                this._applyPaymentsPage();
            }
        },

        onPagerNext: function () {
            var oModel = this.getView().getModel("auditPayments");
            var iPage = oModel.getProperty("/currentPage");
            var iTotalPages = oModel.getProperty("/totalPages");
            if (iPage < iTotalPages) {
                oModel.setProperty("/currentPage", iPage + 1);
                this._applyPaymentsPage();
            }
        },

        onPagerButtonPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("auditPayments");
            var oButton = oContext.getObject();
            if (oButton.ellipsis) {
                return;
            }
            this.getView().getModel("auditPayments").setProperty("/currentPage", oButton.page);
            this._applyPaymentsPage();
        },

        _applyPaymentsPage: function () {
            var oModel = this.getView().getModel("auditPayments");
            var aFiltered = oModel.getProperty("/filtered");
            var iPage = oModel.getProperty("/currentPage");
            var iTotalPages = oModel.getProperty("/totalPages");

            var iStart = (iPage - 1) * PAGE_SIZE;
            var aPageItems = aFiltered.slice(iStart, iStart + PAGE_SIZE);
            oModel.setProperty("/pageItems", aPageItems);

            var aButtons = [];
            if (iTotalPages <= 5) {
                for (var p = 1; p <= iTotalPages; p++) {
                    aButtons.push({ label: String(p), page: p, current: p === iPage, ellipsis: false });
                }
            } else {
                [1, 2, 3].forEach(function (p) {
                    aButtons.push({ label: String(p), page: p, current: p === iPage, ellipsis: false });
                });
                aButtons.push({ label: "...", page: 0, current: false, ellipsis: true });
                aButtons.push({ label: String(iTotalPages), page: iTotalPages, current: iTotalPages === iPage, ellipsis: false });
            }
            oModel.setProperty("/pageButtons", aButtons);
        },

        // ==========================================================
        // DETAIL HEADER ACTIONS
        // ==========================================================

        onViewPaymentDetails: function () {
            MessageToast.show("View Payment Details — coming soon");
        },

        onOpenPaymentExternal: function () {
            MessageToast.show("Open in new window — coming soon");
        },

        // ==========================================================
        // AUDIT EVENTS TABLE / EVENT DETAILS PANEL
        // ==========================================================

        onAuditEventRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("auditEventsTable");
            var oRow = oContext.getObject();

            this.getView().setModel(
                new JSONModel(Object.assign({ visible: true }, oRow)),
                "auditEventDetail"
            );
        },

        onCloseEventDetail: function () {
            this.getView().getModel("auditEventDetail").setProperty("/visible", false);
        },

        onFilterAuditEvents: function () { MessageToast.show("Filter — coming soon"); },
        onViewLogs: function () { MessageToast.show("View Logs — coming soon"); },
        onAuditEventsSettings: function () { MessageToast.show("Settings — coming soon"); },

        onExportAuditEvents: function () {
            var oModel = this.getView().getModel("auditEventsTable");
            var aData = oModel.getProperty("/data") || [];

            if (!aData.length) {
                MessageToast.show("No audit events available to export.");
                return;
            }

            var aColumns = [
                { label: "Timestamp", property: "Timestamp", type: "string" },
                { label: "Event", property: "Event", type: "string" },
                { label: "System", property: "System", type: "string" },
                { label: "Previous Status", property: "PreviousStatus", type: "string" },
                { label: "New Status", property: "NewStatus", type: "string" },
                { label: "Result", property: "Result", type: "string" },
                { label: "User / Service", property: "UserService", type: "string" },
                { label: "Message ID", property: "MessageId", type: "string" },
                { label: "Correlation ID", property: "CorrelationId", type: "string" },
                { label: "ISO 20022 Message Type", property: "IsoMessageType", type: "string" },
                { label: "Error Code", property: "ErrorCode", type: "string" },
                { label: "Error Description", property: "ErrorDescription", type: "string" }
            ];

            var oSettings = {
                workbook: {
                    columns: aColumns,
                    context: {
                        sheetName: "Audit Events"
                    }
                },
                dataSource: aData,
                fileName: "Audit_Events.xlsx",
                worker: false
            };

            var oSpreadsheet = new Spreadsheet(oSettings);

            oSpreadsheet.build()
                .then(function () {
                    MessageToast.show("Audit events exported successfully.");
                })
                .catch(function (oError) {
                    MessageToast.show("Excel export failed. Please try again.");
                    console.error("Audit Excel export error:", oError);
                })
                .finally(function () {
                    oSpreadsheet.destroy();
                });
        },


        onToggleAuditEventsSize: function () {
            var oEventsCard = this.byId("auditEventsCard");
            var oDetailPanel = this.byId("auditEventDetailPanel");
            var oExpandButton = this.byId("auditEventsExpandButton");
            var oDetailModel = this.getView().getModel("auditEventDetail");

            if (!oEventsCard || !oDetailPanel || !oExpandButton) {
                return;
            }

            this._bAuditEventsMaximized = !this._bAuditEventsMaximized;

            if (this._bAuditEventsMaximized) {
                // Expand the audit table across the bottom section.
                oEventsCard.setWidth("100%");
                oDetailPanel.setVisible(false);

                oExpandButton.setIcon("sap-icon://exit-full-screen");
                oExpandButton.setTooltip("Restore audit events layout");


            } else {
                // Restore the table and the previously selected event details.
                oEventsCard.setWidth("68%");

                var bShowDetails = !!oDetailModel.getProperty("/visible");
                oDetailPanel.setVisible(bShowDetails);

                oExpandButton.setIcon("sap-icon://full-screen");
                oExpandButton.setTooltip("Maximize audit events");


            }

            var oTable = this.byId("auditEventsTableCtrl");
            var oScroll = this.byId("auditEventsTableScroll");

            if (oTable) {
                oTable.invalidate();
            }

            if (oScroll) {
                oScroll.invalidate();
            }
        },

        onViewPayload: function () { MessageToast.show("View Payload — coming soon"); },
        onViewAppLog: function () { MessageToast.show("SLG1 Log — coming soon"); }



    });
});