sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/viz/ui5/data/FlattenedDataset", "sap/viz/ui5/controls/common/feeds/FeedItem", "sap/m/Dialog", "sap/m/Button", "sap/ui/export/Spreadsheet"

], function (Controller, JSONModel, Filter, FilterOperator, FlattenedDataset, FeedItem, Dialog, Button, Spreadsheet) {
    "use strict";

    // ‚úÖ Fixed channel ‚Üí color mapping, shared by the Day and Hour flow
    // charts. VizFrame assigns colors by the order values first appear in
    // the bound dataset, so without this, EBICS could render green on one
    // chart and blue on the other depending on which channels had data
    // that day/hour. Both loaders now always emit every channel in this
    // exact order (zero-filled where there's no data), which keeps the
    // first-seen order ‚Äî and therefore the color ‚Äî identical everywhere.
    var CHANNEL_ORDER = ["EBICS", "EBAST2", "BUBASCL", "ISO"];
   // ✅ muted
var CHANNEL_COLORS = ["#cd738b", "#c9a35f", "#7a9e6f", "#8b7aa8"];

    var DONUT_STATUS_CODE_MAP = {
        "Posted": ["31", "34"],
        "Post Processing": ["60", "70"],
        "Pending": ["15", "17", "18", "20", "22", "23", "29", "30", "35", "37", "39", "77", "79"],
        "Failed": ["14", "36", "38"],
        "Rejected": ["73"]

    };

    // ‚úÖ Every chart type in the picker, its icon (confirmed against the SAP
    // icon font where noted), and which feed "mode" it needs ‚Äî because not
    // every chart type can reuse the plain categoryAxis/valueAxis/color
    // feeds our Day/Channel/Payments dataset already uses:
    //   - "axis"     : bar/column/line/stacked variants ‚Äî same feeds as today
    //   - "heatmap"  : two dimensions (Day √ó Channel) + Payments as color
    //   - "share"    : Pie/Donut ‚Äî needs channel totals, not a time series
    //   - "bullet"   : Bullet charts ‚Äî needs an actual + target measure;
    //                  there's no real "target" anywhere in this app's data,
    //                  so Target = average of the totals shown. That's a
    //                  computed reference line, not a business target ‚Äî
    //                  flagged again at the implementation below.
    //   - "waterfall": not a real sap.viz vizType ‚Äî SAP simulates it with a
    //                  stacked column/bar plus a transparent "Blank" offset
    //                  series. Built here as a running cumulative total.
    var CHART_TYPE_CONFIG = {
        bar: { vizType: "bar", label: "Bar Chart", icon: "sap-icon://horizontal-bar-chart-2", mode: "axis" },
        column: { vizType: "column", label: "Column Chart", icon: "sap-icon://vertical-bar-chart", mode: "axis" },
        line: { vizType: "line", label: "Line Chart", icon: "sap-icon://line-chart", mode: "axis" },
        pie: { vizType: "pie", label: "Pie Chart", icon: "sap-icon://pie-chart", mode: "share" },
        donut: { vizType: "donut", label: "Donut Chart", icon: "sap-icon://donut-chart", mode: "share" },
        heatmap: { vizType: "heatmap", label: "Heat Map", icon: "sap-icon://heatmap-chart", mode: "heatmap" },
        // bullet:               { vizType: "bullet",            label: "Bullet Chart",               icon: "sap-icon://horizontal-bullet-chart", mode: "bullet" },
        // vertical_bullet:      { vizType: "vertical_bullet",   label: "Vertical Bullet Chart",       icon: "sap-icon://vertical-bullet-chart",   mode: "bullet" },
        stacked_bar: { vizType: "stacked_bar", label: "Stacked Bar Chart", icon: "sap-icon://horizontal-bar-chart", mode: "axis" },
        stacked_column: { vizType: "stacked_column", label: "Stacked Column Chart", icon: "sap-icon://vertical-bar-chart-2", mode: "axis" },
        "100_stacked_bar": { vizType: "100_stacked_bar", label: "100% Stacked Bar Chart", icon: "sap-icon://full-stacked-chart", mode: "axis" },
        "100_stacked_column": { vizType: "100_stacked_column", label: "100% Stacked Column Chart", icon: "sap-icon://full-stacked-column-chart", mode: "axis" },
        // waterfall:            { vizType: "stacked_column",    label: "Waterfall Chart",             icon: "sap-icon://horizontal-bar-chart-2", mode: "waterfall", key: "waterfall" },
        // horizontal_waterfall: { vizType: "stacked_bar",       label: "Horizontal Waterfall Chart",   icon: "sap-icon://horizontal-bar-chart",   mode: "waterfall", key: "horizontal_waterfall" }
    };



    // ‚úÖ Selectable fields for the transaction table's column-picker (Settings icon).
    // "default: true" fields are what the table shows before the user opens Settings ‚Äî
    // i.e. the 7 fields the table already had. Everything else is off by default and
    // only appears once the user checks it. "date" fields get date formatting; add more
    // entries here any time to expose additional PaymentInfo fields in the picker.
    var PAYMENT_INFO_FIELD_CATALOG = [
        { key: "OrderKey", label: "Order Key", default: true },
        { key: "ProcessingStatus", label: "Processing Status", default: true },
        { key: "TechnicalStatus", label: "Technical Status", default: true },
        { key: "CreatedOn", label: "Created On", default: true, type: "date" },
        { key: "LastChangedBy", label: "Last Changed By", default: true },
        { key: "CreatedBy", label: "Created By", default: true },
        { key: "ReleasedBy", label: "Released By", default: true },

        { key: "ClearingArea", label: "Clearing Area" },
        { key: "PaymentOrderNumber", label: "Payment Order Number" },
        { key: "PaymentOrderDate", label: "Payment Order Date", type: "date" },
        { key: "PaymentOrderStatus", label: "Payment Order Status" },
        { key: "PaymentOrderType", label: "Payment Order Type" },
        { key: "PreviousStatus", label: "Previous Status" },
        { key: "PlannedExecutionDate", label: "Planned Execution Date", type: "date" },
        { key: "ExternalSenderBIC", label: "External Sender BIC" },
        { key: "RecipientBIC", label: "Recipient BIC" },
        { key: "RecipientName", label: "Recipient Name" },
        { key: "ClearingBIC", label: "Clearing BIC" },
        { key: "ExternalOrderNumber", label: "External Order Number" },
        { key: "ObjectListDate", label: "Object List Date", type: "date" },
        { key: "ObjectListNumber", label: "Object List Number" }
    ];

    var ITEM_DETAILS_FIELD_CATALOG = [

        // Default visible columns
        { key: "PaymentItemDate", label: "Payment Item Date", default: true, type: "date" },
        { key: "ClearingArea", label: "Clearing Area", default: true },
        { key: "ItemNumber", label: "Item Number", default: true },
        { key: "ItemProcessingStatus", label: "Item Processing Status", default: true },
        { key: "IncomingPaymentOrder", label: "Incoming Payment Order", default: true },
        { key: "OutgoingPaymentOrder", label: "Outgoing Payment Order", default: true },

        // Additional fields
        { key: "TechnicalStatus", label: "Technical Status" },
        { key: "PreviousTechnicalStatus", label: "Previous Technical Status" },
        { key: "ProcessingDate", label: "Processing Date", type: "date" },
        { key: "ProcessingTime", label: "Processing Time" },
        { key: "SettlementDate", label: "Settlement Date", type: "date" },
        { key: "DueDate", label: "Due Date", type: "date" },
        { key: "PostingDate", label: "Posting Date", type: "date" },
        { key: "ValueDate", label: "Value Date", type: "date" },
        { key: "Country", label: "Country" },
        { key: "BIC", label: "BIC" },
        { key: "IBAN", label: "IBAN" },
        { key: "AccountHolder", label: "Account Holder" },
        { key: "PurposeCode", label: "Purpose Code" },
        { key: "TransactionType", label: "Transaction Type" },
        { key: "PaymentScope", label: "Payment Scope" },
        { key: "TotalAmount", label: "Total Amount" },
        { key: "TransactionCurrency", label: "Transaction Currency" },
        { key: "EndToEndID", label: "End To End ID" }

    ];

    return Controller.extend("payment.dashboard.controller.View1", {

        onInit: function () {


            //KPI tiles

         var oKpiSummaryModel = new JSONModel({
    TotalProcessed: 0,
    SuccessfulPayments: 0,
    FailedPayments: 0,
    RejectedPayments: 0,
    PendingPayments: 0,
    IncomingPayments: 0,
    OutgoingPayments: 0,

    totalProcessedTrend: { percent: 0, direction: "flat", hasData: false, semantic: "neutral" },
    successfulTrend: { percent: 0, direction: "flat", hasData: false, semantic: "goodUp" },
    pendingTrend: { percent: 0, direction: "flat", hasData: false, semantic: "badUp" },
    failedTrend: { percent: 0, direction: "flat", hasData: false, semantic: "badUp" },
    rejectedTrend: { percent: 0, direction: "flat", hasData: false, semantic: "badUp" }
});
this.getView().setModel(oKpiSummaryModel, "kpiSummaryModel");

            console.log("Before Save", this._mVariants);
            this._mVariants = JSON.parse(

                localStorage.getItem("PaymentDashboardVariants") || "{}"

            );

            console.log(
                "Storage",
                JSON.parse(localStorage.getItem("PaymentDashboardVariants"))
            );

            // ‚úÖ KPI date filter ‚Äî defaults to today's system date (sy-datum equivalent)
            var oToday = new Date();
            var sTodayStr = oToday.getFullYear() + "-" +
                String(oToday.getMonth() + 1).padStart(2, "0") + "-" +
                String(oToday.getDate()).padStart(2, "0");

            var oFilterModel = new JSONModel({
                kpiDate: sTodayStr,
                clearingArea: "DEBNKC",   // default selection
                flowGranularity: "Day"
            });
            this.getView().setModel(oFilterModel, "filterModel");



            var oHeaderModel = new JSONModel({ currentTab: "Overview" });
            this.getView().setModel(oHeaderModel, "headerModel");

            //
            var oExceptionModel = new JSONModel({

            });

            this.getView().setModel(oExceptionModel, "exceptionModel");

            //down chart
            var oGosiModel = new JSONModel({

            });

            this.getView().setModel(oGosiModel, "gosiModel");

            //down bar graph
            var oWpsModel = new JSONModel({

            });

            this.getView().setModel(oWpsModel, "wpsModel");

            // table header 
            var oTableInfoModel = new JSONModel({
                total: 0,
                visible: 0
            });
            this.getView().setModel(oTableInfoModel, "tableInfoModel");

            // ‚úÖ Donut center model
            var oModel = new sap.ui.model.json.JSONModel({

            });
            this.getView().setModel(oModel, "donutModel");

            // ‚úÖ Info model for peak hour   
            var oInfoModel = new JSONModel({
                peakHour: "",
                flowChartTitle: "Payments (Value Flow by Day)",
                spikeMessage: "",
                showSpike: false
            });
            this.getView().setModel(oInfoModel, "infoModel");

            // ‚úÖ Date formatting
            var oDate = new Date();
            var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            var sFormattedDate = oDate.toLocaleDateString(undefined, options);

            this.getView().byId("_IDGenText24")
                .setText("Today, " + sFormattedDate + " ‚Payments for All Branches ");

            // ‚úÖ MAIN DATA MODEL
            var oData = {


            };

            // var oModel = this.getOwnerComponent().getModel();

            var oPaymentTableModel = new JSONModel({
                PaymentInfo: []
            });

            this.getView().setModel(oPaymentTableModel, "paymentTable");



            // ‚úÖ Column picker state ‚Äî starts with just the fields the table already
            // showed (the "default: true" ones). Settings dialog adds/removes from this.
            var aDefaultPaymentFields = PAYMENT_INFO_FIELD_CATALOG
                .filter(function (oField) { return oField.default; })
                .map(function (oField) { return oField.key; });

            var oTableColumnsModel = new JSONModel({
                visibleFields: aDefaultPaymentFields
            });
            this.getView().setModel(oTableColumnsModel, "tableColumnsModel");

            this.getView().setModel(
                new JSONModel({ visibleFields: aDefaultPaymentFields.slice() }),
                "detailHeaderColumnsModel"
            );

            this.getView().setModel(
                new JSONModel({ expanded: false, selectedStatus: "" }),
                "donutViewModel"
            );

            this.getView().setModel(
                new JSONModel({
                    // Matches the reference image's default column set ‚Äî user can add
                    // any other ITEM_DETAILS_FIELD_CATALOG field via the Settings gear.
                    visibleFields: ["ItemNumber", "PICreatedDate", "ItemProcessingStatus", "PITransactionAmount", "PIReleaseStatus"]
                }),
                "donutItemsColumnsModel"
            );

            this.getView().setModel(new JSONModel({ items: [] }), "donutItemsModel");

            var aDefaultItemFields = ITEM_DETAILS_FIELD_CATALOG
                .filter(function (oField) {
                    return oField.default;
                })
                .map(function (oField) {
                    return oField.key;
                });

            this.getView().setModel(
                new JSONModel({
                    visibleFields: aDefaultItemFields
                }),
                "itemColumnsModel"
            );

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel);


            this._loadFlowChart();

            this._loadKpiSummary();

            this._refreshExceptionKpis();

            this._rebuildPaymentTable();


            this._refreshReconciliation();
        },

        // ‚úÖ Looks up a field's catalog entry (label / type) by its technical key.
        _getPaymentFieldDef: function (sKey) {
            var aMatches = PAYMENT_INFO_FIELD_CATALOG.filter(function (oField) {
                return oField.key === sKey;
            });
            return aMatches[0];
        },

        _getItemFieldDef: function (sKey) {

            var aMatches = ITEM_DETAILS_FIELD_CATALOG.filter(function (oField) {
                return oField.key === sKey;
            });

            return aMatches[0];

        },

        // ‚úÖ Rebuilds _IDGenTable's columns + row cells from whatever field keys are
        // currently in tableColumnsModel>/visibleFields. Called once on init, and again
        // every time the Settings dialog is confirmed with a new field selection.
        _rebuildPaymentTable: function () {

            var oTable = this.byId("_IDGenTable");
            var aVisibleFields = this.getView().getModel("tableColumnsModel").getProperty("/visibleFields");
            var that = this;

            oTable.destroyColumns();
            oTable.unbindItems();

            // Leading column for the "open details" arrow button ‚Äî no header text
            oTable.addColumn(new sap.m.Column({ width: "3rem" }));

            aVisibleFields.forEach(function (sKey) {
                var oFieldDef = that._getPaymentFieldDef(sKey);
                oTable.addColumn(new sap.m.Column({
                    width: "9rem",
                    header: new sap.m.Text({ text: oFieldDef ? oFieldDef.label : sKey })
                }));
            });



            oTable.bindItems({
                path: "paymentTable>/PaymentInfo",
                factory: function (sId, oContext) {

                    var aCells = [
                        new sap.m.Button({
                            icon: "sap-icon://navigation-right-arrow",
                            type: "Transparent",
                            press: that.onShowPaymentDetails.bind(that)
                        })
                    ];

                    aVisibleFields.forEach(function (sKey) {
                        var oFieldDef = that._getPaymentFieldDef(sKey);

                        if (oFieldDef && oFieldDef.type === "date") {
                            aCells.push(new sap.m.Text({
                                text: {
                                    path: "paymentTable>" + sKey,
                                    type: "sap.ui.model.type.Date",
                                    formatOptions: { source: { pattern: "yyyy-MM-dd" }, style: "medium" }
                                }
                            }));
                        } else if (sKey === "TechnicalStatus") {
                            // Keep the original status-colored pill for this one field
                            aCells.push(
                                new sap.m.ObjectStatus({

                                    text: {
                                        path: "paymentTable>TechnicalStatus",
                                        formatter: that.formatOrderTechnicalStatusText
                                    },

                                    state: {
                                        path: "paymentTable>TechnicalStatus",
                                        formatter: that.formatTechnicalStatusState
                                    }

                                })
                            );
                        } else {
                            aCells.push(new sap.m.Text({ text: "{paymentTable>" + sKey + "}" }));
                        }
                    });

                    return new sap.m.ColumnListItem({ cells: aCells });
                }
            });
        },

        _rebuildPaymentDetailHeader: function (oData) {

            var oGrid = sap.ui.core.Fragment.byId(this.getView().getId(), "_IDGenGrid");
            if (!oGrid) {
                return;
            }

            var aVisibleFields = this.getView()
                .getModel("detailHeaderColumnsModel")   // ← changed from tableColumnsModel
                .getProperty("/visibleFields");

            var that = this;

            oGrid.destroyContent();

            aVisibleFields.forEach(function (sKey) {
                var oFieldDef = that._getPaymentFieldDef(sKey);
                var oLabel = new sap.m.Label({ text: oFieldDef ? oFieldDef.label : sKey });
                var oValueControl;

                if (oFieldDef && oFieldDef.type === "date") {
                    oValueControl = new sap.m.Text({
                        text: {
                            path: "detail>/" + sKey,
                            type: "sap.ui.model.type.Date",
                            formatOptions: { source: { pattern: "yyyy-MM-dd" }, style: "medium" }
                        }
                    });
                } else if (sKey === "TechnicalStatus") {
                    oValueControl = new sap.m.ObjectStatus({
                        text: { path: "detail>/TechnicalStatus", formatter: that.formatOrderTechnicalStatusText },
                        state: { path: "detail>/TechnicalStatus", formatter: that.formatTechnicalStatusState }
                    });
                } else {
                    oValueControl = new sap.m.Text({ text: "{detail>/" + sKey + "}" });
                }

                oGrid.addContent(new sap.m.VBox({ items: [oLabel, oValueControl] }));
            });
        },
        _rebuildItemTable: function () {

            var oTable = this.byId("itemTable");
            var that = this;

            if (!oTable) {
                return;
            }

            var aVisibleFields = this.getView()
                .getModel("itemColumnsModel")
                .getProperty("/visibleFields");

            // Remove previous columns/items
            oTable.destroyColumns();
            oTable.unbindItems();

            // Create Columns
            aVisibleFields.forEach(function (sKey) {

                var oField = that._getItemFieldDef(sKey);

                oTable.addColumn(
                    new sap.m.Column({
                        width: "10rem",
                        header: new sap.m.Text({
                            text: oField ? oField.label : sKey
                        })
                    })
                );

            });

            // Bind rows dynamically
            oTable.bindItems({

                path: "itemModel>/items",

                factory: function (sId) {

                    var aCells = [];

                    aVisibleFields.forEach(function (sKey) {

                        var oField = that._getItemFieldDef(sKey);

                        // Date fields
                        if (oField && oField.type === "date") {

                            aCells.push(

                                new sap.m.Text({

                                    text: {

                                        path: "itemModel>" + sKey,

                                        type: "sap.ui.model.type.Date",

                                        formatOptions: {

                                            source: {

                                                pattern: "yyyy-MM-dd"

                                            },

                                            style: "medium"

                                        }

                                    }

                                })

                            );

                        }

                        // Technical Status

                        else if (sKey === "TechnicalStatus") {

                            aCells.push(
                                new sap.m.ObjectStatus({

                                    text: {
                                        path: "itemModel>TechnicalStatus",
                                        formatter: that.formatTechnicalStatusText
                                    },

                                    state: {
                                        path: "itemModel>TechnicalStatus",
                                        formatter: that.formatTechnicalStatusState
                                    }

                                })

                            );

                        }

                        // Default Text

                        else {

                            aCells.push(

                                new sap.m.Text({

                                    text: "{itemModel>" + sKey + "}"

                                })

                            );

                        }

                    });

                    return new sap.m.ColumnListItem({

                        cells: aCells

                    });

                }

            });

        },

        loadAllTransactions: async function () {

            var oModel = this.getView().getModel("odataModel");

            var oListBinding = oModel.bindList("/PaymentInfo");

            // Request up to 100 records
            var aContexts = await oListBinding.requestContexts(0, 100);

            var aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            this.getView()
                .getModel("paymentTable")
                .setProperty("/PaymentInfo", aData);

            console.log("Total records loaded:", aData.length);
        },
        loadTransactionsByStatus: async function (vStatus) {

            var oModel = this.getView().getModel("odataModel");

            var sClearingArea = this.getView()
                .getModel("filterModel")
                .getProperty("/clearingArea");

            var sKpiDate = this.getView()
                .getModel("filterModel")
                .getProperty("/kpiDate");

            var aStatuses = Array.isArray(vStatus)
                ? vStatus
                : (vStatus !== undefined && vStatus !== null && vStatus !== "" ? [vStatus] : []);

            var aFilters = [];

            // Always filter by Clearing Area
            aFilters.push(
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea)
            );

            // Always filter by Payment Order Date
            aFilters.push(
                new Filter("PaymentOrderDate", FilterOperator.EQ, sKpiDate)
            );

            // Technical Status filter
            if (aStatuses.length === 1) {

                aFilters.push(
                    new Filter("TechnicalStatus", FilterOperator.EQ, aStatuses[0])
                );

            } else if (aStatuses.length > 1) {

                var aStatusFilters = aStatuses.map(function (sStatus) {
                    return new Filter("TechnicalStatus", FilterOperator.EQ, sStatus);
                });

                aFilters.push(
                    new Filter({
                        filters: aStatusFilters,
                        and: false      // OR between statuses
                    })
                );
            }

            var oListBinding = oModel.bindList(
                "/PaymentInfo",
                undefined,
                undefined,
                aFilters
            );

            var aContexts = await oListBinding.requestContexts(0, 100);

            var aData = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            this.getView()
                .getModel("paymentTable")
                .setProperty("/PaymentInfo", aData);
        },
        onTotalProcessedPress: function () {
            this.loadTransactionsByStatus([]);
        },

        onPendingPaymentPress: function () {

            this.loadTransactionsByStatus(["39", "35", "37", "110", "115", "117", "118", "119", "120", "176",

                "177", "178", "179", "180", "101", "103", "105"]);

        },

        onRejectedPaymentPress: function () {

            this.loadTransactionsByStatus(["172", "173"]);

        },
        onSuccessfulPaymentPress: function () {

            this.loadTransactionsByStatus(["128", "130"]);

        },
        onFailedPaymentPress: function () {

            this.loadTransactionsByStatus(["114", "170"]);

        },

        formatTechnicalStatusState: function (sStatus) {

            switch (sStatus) {

                // Successful
                case "128":
                case "130":
                case "230":
                    return sap.ui.core.ValueState.Success;

                // Pending
                case "39":
                case "35":
                case "37":
                case "110":
                case "115":
                case "117":
                case "118":
                case "119":
                case "120":
                case "176":
                case "177":
                case "178":
                case "179":
                case "180":
                case "101":
                case "103":
                case "105":
                    return sap.ui.core.ValueState.Information;

                // Failed
                case "170":
                    return sap.ui.core.ValueState.Warning;

                // Rejected
                case "172":
                case "173":
                    return sap.ui.core.ValueState.Error;

                default:
                    return sap.ui.core.ValueState.None;
            }
        },




        // ‚úÖ AFTER RENDER (chart settings)
        onAfterRendering: function () {



            var oDonut = this.getView().byId("donutChart");
            if (oDonut) {
                oDonut.setVizProperties({
                    title: { visible: false },
                    legend: { visible: false }
                });
            }

            this.updateTableInfo();
             this._attachKpiCardClicks();

        }
        ,





        onShowPaymentDetails: async function (oEvent) {

            var oSource = oEvent.getSource();

            var oContext = oSource.getBindingContext("paymentTable");

            if (!oContext) {
                return;
            }

            var oData = oContext.getObject();
            this._oCurrentDetailData = oData;

            if (!this._oPaymentDialog) {

                this._oPaymentDialog = sap.ui.xmlfragment(
                    this.getView().getId(),
                    "payment.dashboard.view.fragments.PaymentDetails",
                    this
                );

                this.getView().addDependent(this._oPaymentDialog);
            }

            // Header Model
            this._oPaymentDialog.setModel(
                new sap.ui.model.json.JSONModel(oData),
                "detail"
            );

            this._rebuildPaymentDetailHeader(oData);

            // *************** NEW CODE STARTS HERE ****************

            var oModel = this.getOwnerComponent().getModel("odataModel");

            var sPaymentOrder = oData.OrderKey;

            if (sPaymentOrder && sPaymentOrder.indexOf("/") !== -1) {
                sPaymentOrder = sPaymentOrder.split("/")[1].trim();
                sPaymentOrder = sPaymentOrder.replace(/^0+/, ""); // remove leading zeros
            }

            var aFilters = [
                new Filter(
                    "PaymentOrder",
                    FilterOperator.EQ,
                    sPaymentOrder
                )
            ];

            // ‚úÖ Also scope items to the row's Clearing Area and Payment Order Date ‚Äî
            // PaymentOrder alone isn't guaranteed unique across clearing areas/dates
            // (see the sample data: the same PaymentOrderNumber recurs under BOI,
            // DEBNK1, EBATST, FRBNFR, FRBNKC for different runs).
            if (oData.ClearingArea) {
                aFilters.push(
                    new Filter("ClearingArea", FilterOperator.EQ, oData.ClearingArea)
                );
            }

            if (oData.PaymentOrderDate) {
                aFilters.push(
                    new Filter("PaymentOrderDate", FilterOperator.EQ, oData.PaymentOrderDate)
                );
            }

            // Read Item Details
            var oBinding = oModel.bindList(
                "/ItemDetails",
                undefined,
                undefined,
                aFilters
            );

            // Open the dialog first ‚Äî it must open even if the item read fails
            // or returns zero rows.
            this._oPaymentDialog.open();

            var aItems = [];

            try {
                var aContexts = await oBinding.requestContexts(0, 100);

                aItems = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });

                aItems = this._dedupeItems(aItems);

            } catch (oError) {
                // No items found (or the read failed) ‚Äî fall back to an empty
                // list instead of leaving the row/dialog unresponsive.
                console.error("ItemDetails read failed:", oError && (oError.message || oError));
                aItems = [];
            }

            // Bind item model (empty array renders the table's noDataText)
            this._oPaymentDialog.setModel(
                new JSONModel({
                    items: aItems
                }),
                "itemModel"
            );

            this._rebuildItemTable();

            // Update title
            var oTitle = sap.ui.core.Fragment.byId(
                this.getView().getId(),
                "itemTableTitle"
            );

            if (oTitle) {
                oTitle.setText(
                    "Payment Order " +
                    sPaymentOrder +
                    " Items (" +
                    aItems.length +
                    ")"
                );
            }

        },



        onClosePaymentDetails: function () {

            if (this._oPaymentDialog) {
                this._oPaymentDialog.close();
            }

        },

        _dedupeItems: function (aItems) {

            var oSeen = {};

            return aItems.filter(function (oItem) {

                // Unique key for each item
                var sKey = [
                    oItem.ItemNumber,
                    oItem.PaymentOrder,
                    oItem.ClearingArea
                ].join("|");

                if (oSeen[sKey]) {
                    return false;
                }

                oSeen[sKey] = true;
                return true;

            });

        },

        _dedupeDonutItems: function (aItems) {

            var oSeen = {};

            return aItems.filter(function (oItem) {

                // Skip duplicate Item Numbers
                if (oSeen[oItem.ItemNumber]) {
                    return false;
                }

                oSeen[oItem.ItemNumber] = true;
                return true;

            });

        },




        onClearingAreaChange: function () {

            this._loadKpiSummary();
            this._loadFlowChart();
            this._refreshExceptionKpis();
            this._refreshReconciliation();

            this.getView().getModel("donutViewModel").setProperty("/selectedStatus", "");
            this.getView().getModel("donutItemsModel").setProperty("/items", []);

        },

        // ‚úÖ DONUT CLICK INTERACTION
        onDonutSelect: async function (oEvent) {

            var aData = oEvent.getParameter("data");

            if (!aData || !aData.length) {
                return;
            }

            var oSelected = aData[0].data;

            console.log("Selected Object:", oSelected);

            var sStatus = oSelected.Status;

            this.getView()
                .getModel("donutViewModel")
                .setProperty("/selectedStatus", sStatus);

            await this._loadDonutDrillItems(sStatus);

        },

        classifyItemStatus: function (sStatus) {

            sStatus = String(sStatus);

            // Posted
            if (["31", "34"].includes(sStatus)) {
                return "Posted";
            }

            // Post Processing
            if (["60", "70"].includes(sStatus)) {
                return "Post Processing";
            }

            // Pending
            if ([
                "15", "17", "18", "20", "22",
                "23", "29", "30", "35", "37",
                "39", "77", "79"
            ].includes(sStatus)) {
                return "Pending";
            }

            // Failed
            if (["14", "36", "38"].includes(sStatus)) {
                return "Failed";
            }

            // Rejected
            if (["73"].includes(sStatus)) {
                return "Rejected";
            }

            return "Unknown";

        },

        // ‚úÖ Real Mix (Value Flow by Hour) FIND PEAK HOUR 
        calculatePeakHour: function () {

            var oModel = this.getView().getModel();
            if (!oModel) return;
            var aData = oModel.getProperty("/flow");
            if (!aData || aData.length === 0) return;
            var oMax = aData[0];
            aData.forEach(function (item) {
                if (item.value > oMax.value) { oMax = item; }
            });

            // ‚úÖ set highest hour
            this.getView().getModel("infoModel").setProperty("/peakHour", oMax.hour);
        },
        // ‚úÖ Updates only the "visible" (currently displayed/filtered) row count,
        //     leaving "total" untouched so it always reflects the full unfiltered dataset.
        _updateVisibleCount: function (oBinding) {
            var oTableInfoModel = this.getView().getModel("tableInfoModel");
            if (!oTableInfoModel || !oBinding) return;

            var fnUpdate = function () {
                var iCount = oBinding.getLength ? oBinding.getLength() : 0;
                oTableInfoModel.setProperty("/visible", iCount);
            };

            oBinding.attachEventOnce("dataReceived", fnUpdate);
            fnUpdate();
        },

        // Government Sovereign Accounts
        updateTableInfo: function () {
            var oTable = this.byId("_IDGenTable");
            if (!oTable) return;

            var oBinding = oTable.getBinding("items");
            if (!oBinding) return;

            var oTableInfoModel = this.getView().getModel("tableInfoModel");

            var fnUpdate = function () {
                var iCount = oBinding.getLength ? oBinding.getLength() : oTable.getItems().length;
                oTableInfoModel.setData({ total: iCount, visible: iCount });
            };

            oBinding.attachEventOnce("dataReceived", fnUpdate);
            fnUpdate();
        },

        //filter

        onFilterExceptions: function (oEvent) {

            var sQuery = oEvent.getParameter("newValue");

            var oTable = this.byId("_IDGenTable1");
            var oBinding = oTable.getBinding("items");


            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            var aFilters = [
                new sap.ui.model.Filter("id", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("type", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.Contains, sQuery)
            ];

            var oFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false
            });

            oBinding.filter(oFilter);
            this._updateVisibleCount(oBinding);
        },

        //sort
        onOpenSortDialog: function () {
            this.byId("sortDialog").open();
        },

        onSortConfirm: function (oEvent) {

            var oSortItem = oEvent.getParameter("sortItem");
            var bDescending = oEvent.getParameter("sortDescending");

            var sPath = oSortItem.getKey();

            var oTable = this.byId("_IDGenTable1");
            var oBinding = oTable.getBinding("items");

            var oSorter = new sap.ui.model.Sorter(sPath, bDescending);

            oBinding.sort(oSorter);
        },

        onFlowGranularityChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem").getKey();
            this.getView().getModel("filterModel").setProperty("/flowGranularity", sKey);
            this._loadFlowChart();
        },

        _loadFlowChart: function () {
            var sGranularity = this.getView().getModel("filterModel").getProperty("/flowGranularity") || "Day";
            if (sGranularity === "Hour") {
                this._loadFlowByHour();
            } else {
                this._loadHourlyFlow();
            }
        },

        // ‚úÖ Chart-type switcher for the Payments (Value Flow) chart. Builds the
        // full menu from CHART_TYPE_CONFIG (single source of truth for
        // vizType/label/icon/mode) and swaps the button's own icon to match
        // whichever type is currently active.
        onChartTypeMenuPress: function (oEvent) {
            var oButton = oEvent.getSource();

            if (!this._oChartTypeMenu) {

                var aItems = Object.keys(CHART_TYPE_CONFIG).map(function (sConfigKey) {
                    var oConfig = CHART_TYPE_CONFIG[sConfigKey];
                    var oItem = new sap.m.MenuItem({ text: oConfig.label, icon: oConfig.icon });
                    oItem.data("configKey", sConfigKey);
                    return oItem;
                });

                this._oChartTypeMenu = new sap.m.Menu({
                    items: aItems,
                    itemSelected: this.onChartTypeSelected.bind(this)
                });
                this.getView().addDependent(this._oChartTypeMenu);
            }

            this._oChartTypeMenu.openBy(oButton);
        },

        onChartTypeSelected: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sConfigKey = oItem.data("configKey");
            if (!sConfigKey) {
                return;
            }
            this._applyChartType(sConfigKey);
        },

        // ‚úÖ Central dispatcher ‚Äî rebuilds the barChart VizFrame's dataset/feeds
        // to whatever shape the selected chart type needs, sets its vizType, and
        // updates the toggle button's own icon to match. Remembers the active
        // type (_sActiveChartConfigKey) so Day/Hour reloads and date changes can
        // rebuild the same view with fresh data instead of silently reverting to
        // the default stacked column.
        _applyChartType: function (sConfigKey) {
            var oConfig = CHART_TYPE_CONFIG[sConfigKey];
            var oBarChart = this.byId("barChart");
            if (!oConfig || !oBarChart) {
                return;
            }

            this._sActiveChartConfigKey = sConfigKey;

            var oButton = this.byId("chartTypeButton");
            if (oButton) {
                oButton.setIcon(oConfig.icon);
                oButton.setTooltip(oConfig.label);
            }

            switch (oConfig.mode) {
                case "heatmap":
                    this._applyHeatmapChartType();
                    break;
                case "share":
                    this._applyShareChartType(oConfig.vizType);
                    break;
                case "bullet":
                    this._applyBulletChartType(oConfig.vizType);
                    break;
                case "waterfall":
                    this._applyWaterfallChartType(oConfig.vizType);
                    break;
                default:
                    this._applyAxisChartType(oConfig.vizType);
            }
        },

        // Re-runs whichever chart type is currently selected against the latest
        // flowModel data ‚Äî called after every Day/Hour reload or date change so
        // a non-default chart type (Pie, Waterfall, etc.) doesn't go stale.
        _reapplyActiveChartType: function () {
            this._applyChartType(this._sActiveChartConfigKey || "stacked_column");
        },

        // ‚îÄ‚îÄ Shared aggregation helpers ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
        _getDayTotals: function () {
            var aData = this.getView().getModel("flowModel").getProperty("/data") || [];
            var oTotals = {};
            var aOrder = [];
            aData.forEach(function (o) {
                if (!(o.Day in oTotals)) {
                    oTotals[o.Day] = 0;
                    aOrder.push(o.Day);
                }
                oTotals[o.Day] += o.Payments || 0;
            });
            aOrder.sort();
            return aOrder.map(function (sDay) { return { Day: sDay, Total: oTotals[sDay] }; });
        },

        _getChannelTotals: function () {
            var aData = this.getView().getModel("flowModel").getProperty("/data") || [];
            var oTotals = {};
            aData.forEach(function (o) {
                oTotals[o.Channel] = (oTotals[o.Channel] || 0) + (o.Payments || 0);
            });
            return CHANNEL_ORDER
                .filter(function (sChannel) { return oTotals[sChannel] !== undefined; })
                .map(function (sChannel) { return { Channel: sChannel, Total: oTotals[sChannel] }; });
        },

        // ‚îÄ‚îÄ Mode implementations ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

        // Bar/Column/Line/Stacked/100% Stacked ‚Äî all reuse the existing
        // Day/Channel/Payments dataset and categoryAxis/valueAxis/color feeds.
        _applyAxisChartType: function (sVizType) {
            var oBarChart = this.byId("barChart");

            oBarChart.removeAllFeeds();
            oBarChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{flowModel>Day}" },
                    { name: "Channel", value: "{flowModel>Channel}" }
                ],
                measures: [
                    { name: "Payments", value: "{flowModel>Payments}" }
                ],
                data: { path: "flowModel>/data" }
            }));
            oBarChart.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Payments"] }));
            oBarChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oBarChart.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Channel"] }));

            oBarChart.setVizType(sVizType);
            oBarChart.setVizProperties({ plotArea: { colorPalette: CHANNEL_COLORS } });
        },

        // Heat Map ‚Äî Day √ó Channel grid, colored by Payments volume.
        _applyHeatmapChartType: function () {
            var oBarChart = this.byId("barChart");

            oBarChart.removeAllFeeds();
            oBarChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{flowModel>Day}" },
                    { name: "Channel", value: "{flowModel>Channel}" }
                ],
                measures: [
                    { name: "Payments", value: "{flowModel>Payments}" }
                ],
                data: { path: "flowModel>/data" }
            }));
            oBarChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oBarChart.addFeed(new FeedItem({ uid: "categoryAxis2", type: "Dimension", values: ["Channel"] }));
            oBarChart.addFeed(new FeedItem({ uid: "color", type: "Measure", values: ["Payments"] }));

            oBarChart.setVizType("heatmap");
        },

        // Pie/Donut ‚Äî these show a part-to-whole breakdown, not a time series, so
        // the day/hour dimension is dropped in favor of totals per channel across
        // whatever window is currently loaded (5-day window, or the single
        // selected day, depending on the Day/Hour toggle).
        _applyShareChartType: function (sVizType) {
            var oBarChart = this.byId("barChart");
            var aChannelTotals = this._getChannelTotals();

            this.getView().getModel("flowModel").setProperty("/channelShare", aChannelTotals);

            oBarChart.removeAllFeeds();
            oBarChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Channel", value: "{flowModel>Channel}" }
                ],
                measures: [
                    { name: "Total", value: "{flowModel>Total}" }
                ],
                data: { path: "flowModel>/channelShare" }
            }));
            oBarChart.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["Total"] }));
            oBarChart.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Channel"] }));

            oBarChart.setVizType(sVizType);
            oBarChart.setVizProperties({ plotArea: { colorPalette: CHANNEL_COLORS } });
        },

        // ‚ö†Ô∏è Bullet charts are built for actual-vs-target on a single metric, not
        // a multi-channel time series, and there's no real "target" value
        // anywhere in this app's data. Target here is the average of the day/hour
        // totals currently shown ‚Äî a computed "vs. average" reference line, not
        // a business target. One bullet per Day/Hour category, Actual = that
        // period's total across all channels.
        _applyBulletChartType: function (sVizType) {
            var oBarChart = this.byId("barChart");
            var aDayTotals = this._getDayTotals();
            var fAverage = aDayTotals.length
                ? aDayTotals.reduce(function (n, o) { return n + o.Total; }, 0) / aDayTotals.length
                : 0;

            var aBulletData = aDayTotals.map(function (o) {
                return { Day: o.Day, Actual: o.Total, Target: fAverage };
            });

            this.getView().getModel("flowModel").setProperty("/bulletData", aBulletData);

            oBarChart.removeAllFeeds();
            oBarChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{flowModel>Day}" }
                ],
                measures: [
                    { name: "Actual", value: "{flowModel>Actual}" },
                    { name: "Target", value: "{flowModel>Target}" }
                ],
                data: { path: "flowModel>/bulletData" }
            }));
            oBarChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oBarChart.addFeed(new FeedItem({ uid: "actualValues", type: "Measure", values: ["Actual"] }));
            oBarChart.addFeed(new FeedItem({ uid: "targetValues", type: "Measure", values: ["Target"] }));

            oBarChart.setVizType(sVizType);
        },

        // Waterfall / Horizontal Waterfall ‚Äî "waterfall" isn't a real sap.viz
        // vizType; SAP itself simulates it with a stacked column/bar plus a
        // transparent "Blank" offset series (confirmed against SAP's own sample
        // approach). Shows a running cumulative total across the visible window:
        // each bar's invisible base is the running total through the previous
        // period, and its colored segment is that period's own contribution.
        _applyWaterfallChartType: function (sVizType) {
            var oBarChart = this.byId("barChart");
            var aDayTotals = this._getDayTotals();

            var aWaterfallData = [];
            var fRunning = 0;
            aDayTotals.forEach(function (o) {
                aWaterfallData.push({ Day: o.Day, Type: "Blank", Value: fRunning });
                aWaterfallData.push({ Day: o.Day, Type: "This Period", Value: o.Total });
                fRunning += o.Total;
            });

            this.getView().getModel("flowModel").setProperty("/waterfallData", aWaterfallData);

            oBarChart.removeAllFeeds();
            oBarChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{flowModel>Day}" },
                    { name: "Type", value: "{flowModel>Type}" }
                ],
                measures: [
                    { name: "Value", value: "{flowModel>Value}" }
                ],
                data: { path: "flowModel>/waterfallData" }
            }));
            oBarChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oBarChart.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Value"] }));
            oBarChart.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Type"] }));

            oBarChart.setVizType(sVizType);
            oBarChart.setVizProperties({
                plotArea: { colorPalette: ["transparent", "#2E90FA"] }
            });
        },







        // ‚úÖ aged maximum




        onTabSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            this.getView().getModel("headerModel").setProperty("/currentTab", oItem.getText());
        },





        onCloseKpiDialog: function () {

            if (this._oPoKpiDialog) {
                this._oPoKpiDialog.close();
            }
        },

        //KPI Tiles 
        // ✅ The Exceptions tab (view/Exceptions.view.xml) is a separate nested
        // XMLView with its own controller, so it doesn't get _loadKpiSummary's
        // update automatically — this reaches into it and reruns its own
        // ExceptionKPI read whenever the shared Clearing Area / Date filter
        // changes here on the Overview tab's header.
        _refreshExceptionKpis: function () {

            var oExceptionView = this.byId("ExceptionsView");

            if (oExceptionView) {

                var oController = oExceptionView.getController();

                if (oController) {

                    oController.loadExceptionKpis();

                    oController.loadExceptionReasons();

                    // IMPORTANT: refresh Exception Trend as well
                    oController.loadExceptionTrend();

                    // Refresh "By Rail" pie chart (RailKpi entity set)
                    oController.loadRailKpi();
                }
            }
        },

        // ✅ Same pattern as _refreshExceptionKpis — the Reconciliation tab
        // (view/Reconciliation.view.xml) is a separate nested XMLView with its
        // own controller and its own "reconciliation" JSONModel, so it doesn't
        // get updated automatically when Clearing Area / Date change here on
        // the Overview tab's header. This reaches into it and reruns its own
        // OData read whenever the shared filter changes.
        _refreshReconciliation: function () {

            var oReconciliationView = this.byId("ReconciliationView");

            if (oReconciliationView) {

                var oController = oReconciliationView.getController();

                if (oController) {

                    oController.loadReconciliationData();

                }

            }

        },

       _loadKpiSummary: function () {

    var oODataModel = this.getOwnerComponent().getModel("odataModel");
    var oKpiSummaryModel = this.getView().getModel("kpiSummaryModel");
    var sKpiDate = this.getView().getModel("filterModel").getProperty("/kpiDate");

    var sClearingArea = this.getView()
        .getModel("filterModel")
        .getProperty("/clearingArea");

    if (!oODataModel || !sClearingArea || !sKpiDate) {
        return;
    }

    var sPreviousDate = this._getPreviousDateStr(sKpiDate);

    var fnReadKpiForDate = function (sTargetDate) {

        var aFilters = [
            new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
            new Filter("PaymentOrderDate", FilterOperator.EQ, sTargetDate)
        ];

        var oListBinding = oODataModel.bindList("/OrderKPI", undefined, undefined, aFilters, {
            $select: "ClearingArea,PaymentOrderDate,TotalProcessed,SuccessfulPayments,RejectedPayments,FailedPayments,PendingPayments"
        });

        return oListBinding.requestContexts(0, 1).then(function (aContexts) {

            if (!aContexts.length) {
                return {
                    TotalProcessed: 0, SuccessfulPayments: 0,
                    RejectedPayments: 0, FailedPayments: 0, PendingPayments: 0
                };
            }

            var oRow = aContexts[0].getObject();

            return {
                TotalProcessed: oRow.TotalProcessed || 0,
                SuccessfulPayments: oRow.SuccessfulPayments || 0,
                RejectedPayments: oRow.RejectedPayments || 0,
                FailedPayments: oRow.FailedPayments || 0,
                PendingPayments: oRow.PendingPayments || 0
            };

        }).catch(function (oError) {
            console.error("KPI summary load failed for", sTargetDate, oError);
            return {
                TotalProcessed: 0, SuccessfulPayments: 0,
                RejectedPayments: 0, FailedPayments: 0, PendingPayments: 0
            };
        });

    };

    Promise.all([
        fnReadKpiForDate(sKpiDate),
        fnReadKpiForDate(sPreviousDate)
    ]).then(function (aResults) {

        var oToday = aResults[0];
        var oYesterday = aResults[1];

        oKpiSummaryModel.setData({
            TotalProcessed: oToday.TotalProcessed,
            SuccessfulPayments: oToday.SuccessfulPayments,
            RejectedPayments: oToday.RejectedPayments,
            FailedPayments: oToday.FailedPayments,
            PendingPayments: oToday.PendingPayments,
            IncomingPayments: 0,
            OutgoingPayments: 0,

            totalProcessedTrend: this._computeKpiTrend(oToday.TotalProcessed, oYesterday.TotalProcessed, "neutral"),
            successfulTrend: this._computeKpiTrend(oToday.SuccessfulPayments, oYesterday.SuccessfulPayments, "goodUp"),
            pendingTrend: this._computeKpiTrend(oToday.PendingPayments, oYesterday.PendingPayments, "badUp"),
            failedTrend: this._computeKpiTrend(oToday.FailedPayments, oYesterday.FailedPayments, "badUp"),
            rejectedTrend: this._computeKpiTrend(oToday.RejectedPayments, oYesterday.RejectedPayments, "badUp")
        });

        this._updateStatusBreakdown();

    }.bind(this));

},

// ✅ Returns "YYYY-MM-DD" for the day before sDate — local date math (not
// toISOString()) to avoid UTC-shift issues, same pattern already used in
// Exceptions.controller.js's _getPreviousDateStr.
_getPreviousDateStr: function (sDate) {

    var aParts = String(sDate).slice(0, 10).split("-");

    var oDate = new Date(
        Number(aParts[0]),
        Number(aParts[1]) - 1,
        Number(aParts[2])
    );

    oDate.setDate(oDate.getDate() - 1);

    return oDate.getFullYear() + "-" +
        String(oDate.getMonth() + 1).padStart(2, "0") + "-" +
        String(oDate.getDate()).padStart(2, "0");

},

// ✅ Computes % change fPrevious → fCurrent, tagged with which direction
// counts as "good" so the formatter can pick the right color:
//   "goodUp"  — rising is good (Successful Payments)
//   "badUp"   — rising is bad (Pending/Failed/Rejected)
//   "neutral" — no color judgement (Total Processed — just informational)
_computeKpiTrend: function (fCurrent, fPrevious, sSemantic) {

    if (!fPrevious || fPrevious === 0) {
        return {
            percent: 0,
            direction: fCurrent > 0 ? "up" : "flat",
            hasData: false,
            semantic: sSemantic
        };
    }

    var fPercent = ((fCurrent - fPrevious) / fPrevious) * 100;

    return {
        percent: Math.abs(fPercent),
        direction: fPercent > 0 ? "up" : (fPercent < 0 ? "down" : "flat"),
        hasData: true,
        semantic: sSemantic
    };

},


        onKpiDateChange: function (oEvent) {
            var bValid = oEvent.getParameter("valid");
            var sNewDate = oEvent.getParameter("value");

            if (!bValid || !sNewDate) {
                return;
            }

            this.getView().getModel("filterModel").setProperty("/kpiDate", sNewDate);
            this._loadKpiSummary();
            this._refreshExceptionKpis();
            this._refreshReconciliation();
            this._loadFlowChart();
            this._oOriginalChartParent = null;
            this._iOriginalChartIndex = 0;
            this._bChartExpanded = false;
            this._oTransactionParent = null;
            this._iTransactionIndex = 0;
            this._bTransactionExpanded = false;
            this.getView().getModel("donutViewModel").setProperty("/selectedStatus", "");
            this.getView().getModel("donutItemsModel").setProperty("/items", []);
        },

        // real mix by day

        // real mix by day ‚Äî 5-day window ending on the KPI date

        _loadHourlyFlow: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");

            var oFlowModel = new JSONModel({ data: [] });
            this.getView().setModel(oFlowModel, "flowModel");

            // ‚úÖ Anchor the 5-day window on the KPI date picker value (e.g. selecting
            // Apr 7 gives Apr 3‚ÄìApr 7)
            var sKpiDate = this.getView().getModel("filterModel").getProperty("/kpiDate");

            var fnToDateStr = function (oDate) {
                var y = oDate.getFullYear();
                var m = String(oDate.getMonth() + 1).padStart(2, "0");
                var d = String(oDate.getDate()).padStart(2, "0");
                return y + "-" + m + "-" + d;
            };

            var oEndDate = new Date(sKpiDate + "T00:00:00");
            var oStartDate = new Date(oEndDate);
            oStartDate.setDate(oStartDate.getDate() - 4);

            var sStartDate = fnToDateStr(oStartDate);
            var sEndDate = sKpiDate;

            // Wrap the two same-property date filters together with and:true ‚Äî
            // otherwise UI5 auto-groups same-path filters with OR by default,
            // which is why every date was coming back.
            var oDateRangeFilter = new Filter({
                filters: [
                    new Filter("ProcessedDate", FilterOperator.GE, sStartDate),
                    new Filter("ProcessedDate", FilterOperator.LE, sEndDate)
                ],
                and: true
            });

            var sClearingArea = this.getView()
                .getModel("filterModel")
                .getProperty("/clearingArea");

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                oDateRangeFilter
            ];

            var oListBinding = oODataModel.bindList("/DailyPaymentTrend", undefined, undefined, aFilters, {
                $select: "ClearingArea,ProcessedDate,Channel,PaymentCount"
            });

            oListBinding.requestContexts(0, 500).then(function (aContexts) {

                var aRows = aContexts.map(function (oCtx) {
                    return oCtx.getObject();
                });

                var oMap = {};
                aRows.forEach(function (oRow) {
                    var sDay = oRow.ProcessedDate;
                    var sChannel = oRow.Channel;
                    var sKey = sDay + "|" + sChannel;

                    if (!oMap[sKey]) {
                        oMap[sKey] = { Day: sDay, Channel: sChannel, Payments: 0 };
                    }
                    oMap[sKey].Payments += oRow.PaymentCount || 0;
                });

                // ‚úÖ Build the full list of 5 calendar days in the window, regardless
                // of whether data exists for each one
                var aAllDaysInWindow = [];
                var oCursor = new Date(sStartDate + "T00:00:00");
                for (var i = 0; i < 5; i++) {
                    aAllDaysInWindow.push(fnToDateStr(oCursor));
                    oCursor.setDate(oCursor.getDate() + 1);
                }

                // ‚úÖ Ensure every day in the window has an entry for every known
                // channel (even if zero, in CHANNEL_ORDER's fixed order) ‚Äî this is
                // what keeps color assignment consistent with the Hour chart, since
                // VizFrame colors by first-seen order in the dataset.
                aAllDaysInWindow.forEach(function (sDay) {
                    CHANNEL_ORDER.forEach(function (sChannel) {
                        var sKey = sDay + "|" + sChannel;
                        if (!oMap[sKey]) {
                            oMap[sKey] = { Day: sDay, Channel: sChannel, Payments: 0 };
                        }
                    });
                });

                var aFlowData = Object.keys(oMap)
                    .map(function (sKey) { return oMap[sKey]; })
                    .sort(function (a, b) {
                        var iDayCompare = a.Day.localeCompare(b.Day);
                        if (iDayCompare !== 0) { return iDayCompare; }
                        return CHANNEL_ORDER.indexOf(a.Channel) - CHANNEL_ORDER.indexOf(b.Channel);
                    });

                oFlowModel.setProperty("/data", aFlowData);
                this._reapplyActiveChartType();

                this.getView().getModel("infoModel").setProperty("/flowChartTitle", "Payments (Value Flow by Day)");
                var oBarChartDay = this.byId("barChart");
                if (oBarChartDay) {
                    oBarChartDay.setVizProperties({
                        categoryAxis: { title: { visible: true, text: "Day" } },
                        plotArea: { colorPalette: CHANNEL_COLORS }
                    });
                }

                var oDayTotals = {};
                aFlowData.forEach(function (o) {
                    oDayTotals[o.Day] = (oDayTotals[o.Day] || 0) + o.Payments;
                });

                var sPeakDay = null;
                var iPeakVal = -1;
                Object.keys(oDayTotals).forEach(function (sDay) {
                    if (oDayTotals[sDay] > iPeakVal) {
                        iPeakVal = oDayTotals[sDay];
                        sPeakDay = sDay;
                    }
                });

                if (sPeakDay) {
                    this.getView().getModel("infoModel").setProperty("/peakHour", sPeakDay);
                    this.getView().getModel("infoModel").setProperty("/spikeMessage", sPeakDay + " spike driven by Daily Payments");
                    this.getView().getModel("infoModel").setProperty("/showSpike", true);
                } else {
                    this.getView().getModel("infoModel").setProperty("/showSpike", false);
                }

            }.bind(this)).catch(function (oError) {
                console.error("Daily flow load failed:", oError);
            });
        },

        _loadFlowByHour: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFlowModel = this.getView().getModel("flowModel");

            var sKpiDate = this.getView().getModel("filterModel").getProperty("/kpiDate");

            var sClearingArea = this.getView()
                .getModel("filterModel")
                .getProperty("/clearingArea");

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("ProcessedDate", FilterOperator.EQ, sKpiDate)
            ];

            var oListBinding = oODataModel.bindList("/HourlyPaymentTrend", undefined, undefined, aFilters, {
                $select: "ClearingArea,ProcessedDate,PaymentHour,Channel,PaymentCount"
            });

            oListBinding.requestContexts(0, 500).then(function (aContexts) {

                var aRows = aContexts.map(function (oCtx) { return oCtx.getObject(); });

                var oMap = {};
                aRows.forEach(function (oRow) {
                    var sHour = oRow.PaymentHour + ":00";   // "08" ‚Üí "08:00"
                    var sChannel = oRow.Channel;
                    var sKey = sHour + "|" + sChannel;

                    if (!oMap[sKey]) {
                        oMap[sKey] = { Day: sHour, Channel: sChannel, Payments: 0 };
                    }
                    oMap[sKey].Payments += oRow.PaymentCount || 0;
                });

                // ‚úÖ Build the full 24-hour axis (00:00‚Äì23:00), regardless of whether
                // data exists for each hour ‚Äî mirrors the 5-day window logic in
                // _loadHourlyFlow so a day with no traffic still renders an empty
                // axis with zero-height bars instead of a bare "No data" chart.
                var aAllHoursInWindow = [];
                for (var h = 0; h < 24; h++) {
                    aAllHoursInWindow.push(String(h).padStart(2, "0") + ":00");
                }

                // ‚úÖ Ensure every hour has an entry for every known channel (even if
                // zero, in CHANNEL_ORDER's fixed order) ‚Äî keeps color assignment
                // consistent with the Day chart, and doubles as the empty-state fill
                // (a quiet day just renders all-zero bars across a full 24h axis).
                aAllHoursInWindow.forEach(function (sHour) {
                    CHANNEL_ORDER.forEach(function (sChannel) {
                        var sKey = sHour + "|" + sChannel;
                        if (!oMap[sKey]) {
                            oMap[sKey] = { Day: sHour, Channel: sChannel, Payments: 0 };
                        }
                    });
                });

                var aFlowData = Object.keys(oMap)
                    .map(function (sKey) { return oMap[sKey]; })
                    .sort(function (a, b) {
                        var iHourCompare = a.Day.localeCompare(b.Day);
                        if (iHourCompare !== 0) { return iHourCompare; }
                        return CHANNEL_ORDER.indexOf(a.Channel) - CHANNEL_ORDER.indexOf(b.Channel);
                    });

                oFlowModel.setProperty("/data", aFlowData);

                this.getView().getModel("infoModel").setProperty("/flowChartTitle", "Payments (Value Flow by Hour)");
                var oBarChartHour = this.byId("barChart");
                if (oBarChartHour) {
                    oBarChartHour.setVizProperties({
                        categoryAxis: { title: { visible: true, text: "Hour" } },
                        plotArea: { colorPalette: CHANNEL_COLORS }
                    });
                }

                var oHourTotals = {};
                aFlowData.forEach(function (o) {
                    oHourTotals[o.Day] = (oHourTotals[o.Day] || 0) + o.Payments;
                });

                var sPeakHour = null;
                var iPeakVal = -1;
                Object.keys(oHourTotals).forEach(function (sHour) {
                    if (oHourTotals[sHour] > iPeakVal) {
                        iPeakVal = oHourTotals[sHour];
                        sPeakHour = sHour;
                    }
                });

                if (sPeakHour && iPeakVal > 0) {
                    this.getView().getModel("infoModel").setProperty("/peakHour", sPeakHour);
                    this.getView().getModel("infoModel").setProperty("/spikeMessage", sPeakHour + " spike driven by Daily Payments");
                    this.getView().getModel("infoModel").setProperty("/showSpike", true);
                } else {
                    this.getView().getModel("infoModel").setProperty("/showSpike", false);
                }

            }.bind(this)).catch(function (oError) {
                console.error("Hourly flow load failed:", oError);
            });
        },

        onPaymentInfoTableUpdateFinished: function (oEvent) {
            var oTableInfoModel = this.getView().getModel("tableInfoModel");
            if (!oTableInfoModel) return;

            var iTotal = oEvent.getParameter("total");
            var iActual = oEvent.getParameter("actual");
            var iCount = (iTotal !== undefined && iTotal !== null) ? iTotal : iActual;

            oTableInfoModel.setProperty("/visible", iCount);
        },

        //Search bar for daily payment flow table
        onFilterPaymentInfo: function (oEvent) {

            var sQuery = oEvent.getParameter("newValue");

            var oTable = this.byId("_IDGenTable");
            var oBinding = oTable.getBinding("items");

            if (!oBinding) {
                console.error("No binding found on _IDGenTable ‚Äî check the table's items path.");
                return;
            }

            if (!sQuery) {
                oBinding.filter([]);

                return;
            }

            var sTrimmed = sQuery.trim();

            // ‚úÖ Max length per field (from backend $metadata / observed 400 errors).
            //     Use a large number for fields with no known restriction.
            var oFieldMaxLengths = {
                "OrderKey": 100,
                "LastChangedBy": 100,
                "CreatedBy": 100,
                "ReleasedBy": 100,
                "TechnicalStatus": 3,
                "ProcessingStatus": 3
            };

            var aFilters = [];

            Object.keys(oFieldMaxLengths).forEach(function (sField) {
                var iMaxLen = oFieldMaxLengths[sField];
                if (sTrimmed.length <= iMaxLen) {
                    aFilters.push(new Filter(sField, FilterOperator.Contains, sTrimmed));
                }
            });

            // ‚úÖ CreatedOn is Edm.Date ‚Äî Contains doesn't work on dates, needs EQ
            //     Only fire when query looks like a full YYYY-MM-DD date
            // if (/^\d{4}-\d{2}-\d{2}$/.test(sTrimmed)) {
            //     aFilters.push(new Filter("CreatedOn", FilterOperator.EQ, sTrimmed));
            // }

            // ‚úÖ CreatedOn is Edm.Date ‚Äî try to parse flexible date text into YYYY-MM-DD
            var sIsoDate = this._parseToIsoDate(sTrimmed);
            if (sIsoDate) {
                aFilters.push(new Filter("CreatedOn", FilterOperator.EQ, sIsoDate));
            }

            if (aFilters.length === 0) {
                // Query too long for every known field ‚Äî nothing to search
                oBinding.filter([]);

                return;
            }

            var oFilter = new Filter({
                filters: aFilters,
                and: false   // OR across fields
            });

            // üîç TEMP DEBUG ‚Äî remove once confirmed working
            oBinding.attachEventOnce("dataReceived", function (oDataEvent) {
                var oError = oDataEvent.getParameter("error");
                if (oError) {
                    console.error("PaymentInfo filter request failed:", oError.message || oError);
                } else {
                    console.log("PaymentInfo filter succeeded, rows:", oBinding.getLength());
                }
            });

            oBinding.filter(oFilter);

        },

        // ‚úÖ Parses flexible date text ("Jun 15, 2026", "06/15/2026", "2026-06-15", etc.)
        //     into a strict "YYYY-MM-DD" string, or returns null if it's not a recognizable date.
        _parseToIsoDate: function (sText) {

            // Fast path: already in YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(sText)) {
                return sText;
            }

            // Must contain at least one digit and be reasonably date-like in length,
            // otherwise skip parsing (avoids treating names like "F0004468" as dates)
            if (!/\d/.test(sText) || sText.length < 6 || sText.length > 30) {
                return null;
            }

            var oDate = new Date(sText);

            if (isNaN(oDate.getTime())) {
                return null;
            }

            var iYear = oDate.getFullYear();
            var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            var sDay = String(oDate.getDate()).padStart(2, "0");

            return iYear + "-" + sMonth + "-" + sDay;
        },


        //Donut status breakdown 
        // Donut status breakdown
        _updateStatusBreakdown: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");

            var sKpiDate = this.getView()
                .getModel("filterModel")
                .getProperty("/kpiDate");

            var sClearingArea = this.getView()
                .getModel("filterModel")
                .getProperty("/clearingArea");

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("PaymentOrderDate", FilterOperator.EQ, sKpiDate)
            ];

            var oBinding = oODataModel.bindList(
                "/PiKPI",
                undefined,
                undefined,
                aFilters
            );

            oBinding.requestContexts(0, 1).then(function (aContexts) {

                var posted = 0;
                var processing = 0;
                var pending = 0;
                var failed = 0;
                var rejected = 0;

                if (aContexts.length) {

                    var oRow = aContexts[0].getObject();

                    posted = Number(oRow.SuccessfulPI || 0);
                    processing = Number(oRow.InPostProcessingPI || 0);
                    pending = Number(oRow.PendingPI || 0);
                    failed = Number(oRow.FailedPI || 0);
                    rejected = Number(oRow.RejectedPI || 0);
                }

                var total =
                    posted +
                    processing +
                    pending +
                    failed +
                    rejected;

                function pct(v) {
                    return total === 0
                        ? "0%"
                        : ((v / total) * 100).toFixed(1) + "%";
                }

                function fmt(v) {
                    if (v >= 1000000) {
                        return (v / 1000000).toFixed(1) + "M";
                    }
                    if (v >= 1000) {
                        return (v / 1000).toFixed(1) + "K";
                    }
                    return String(v);
                }

                var bNoData = total === 0;

                var oStatusModel = new JSONModel({

                    data: bNoData
                        ? [{
                            status: "No Data",
                            value: 1
                        }]
                        : [
                            {
                                status: "Posted",
                                value: posted
                            },
                            {
                                status: "Post Processing",
                                value: processing
                            },
                            {
                                status: "Pending",
                                value: pending
                            },
                            {
                                status: "Failed",
                                value: failed
                            },
                            {
                                status: "Rejected",
                                value: rejected
                            }
                        ],

                    totalText: fmt(total) + " Payment Items",

                    posted: {
                        display: fmt(posted)
                    },

                    processing: {
                        display: fmt(processing)
                    },

                    pending: {
                        display: fmt(pending)
                    },

                    failed: {
                        display: fmt(failed)
                    },

                    rejected: {
                        display: fmt(rejected)
                    }

                });

                this.getView().setModel(
                    oStatusModel,
                    "statusModel"
                );

                var oDonut = this.byId("donutChart");

               // ❌ current
// ✅ muted
if (oDonut) {
    oDonut.setVizProperties({
        plotArea: {
            colorPalette: bNoData
                ? ["#E0E0E0"]
                : [
                    "#cd738b", // Posted
                    "#7a9e6f", // Post Processing
                    "#c9cbd9", // Pending
                    "#8b7aa8", // Failed
                    "#c9a35f"  // Rejected
                ]
        }
    });
}

                this.getView()
                    .getModel("donutModel")
                    .setData({

                        value: pct(posted),

                        label: bNoData
                            ? "No Data"
                            : "Posted"

                    });

            }.bind(this));

        },

        _loadDonutDrillItems: async function (sStatus) {

            var oFilterModel = this.getView().getModel("filterModel");
            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sKpiDate = oFilterModel.getProperty("/kpiDate");

            // Read via plain fetch instead of bindList().requestContexts() ‚Äî
            // ItemDetails' key (Guid, SegmentationKey, TimePart) doesn't include
            // ItemNumber, so one payment order's multiple item rows share the same
            // key predicate. UI5's v4 ODataListBinding rejects that as a "Duplicate
            // key predicate" and fails the WHOLE read. A raw fetch has no such
            // uniqueness requirement ‚Äî we just want the rows, not bound contexts.
            var sServiceUrl = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri");

            var sFilter = "ClearingArea eq '" + sClearingArea + "'" +
                " and PaymentOrderDate eq " + sKpiDate;

            var sUrl = sServiceUrl + "ItemDetails?$filter=" + encodeURIComponent(sFilter) + "&$top=500";

            var aAllItems = [];
            try {
                var oResponse = await fetch(sUrl, {
                    headers: { "Accept": "application/json" },
                    credentials: "same-origin"
                });

                if (!oResponse.ok) {
                    throw new Error("HTTP " + oResponse.status);
                }

                var oJson = await oResponse.json();
                aAllItems = oJson.value || [];

            } catch (oError) {
                console.error("Donut drill-down ItemDetails read failed:", oError && (oError.message || oError));
            }

            // Diagnostic ‚Äî safe to remove once counts line up with the KPI tiles.
            var oTally = {};

            var that = this;

            aAllItems.forEach(function (o) {

                var b = that.classifyItemStatus(o.ItemProcessingStatus);

                oTally[b] = (oTally[b] || 0) + 1;

            }); console.log("ItemProcessingStatus bucket tally for", sClearingArea, sKpiDate, ":", oTally);

            var that = this;

            var aItems = aAllItems.filter(function (o) {

                return that.classifyItemStatus(o.ItemProcessingStatus) === sStatus;

            });

            aItems = this._dedupeDonutItems(aItems);

            this.getView().getModel("donutItemsModel").setProperty("/items", aItems);
            this._rebuildDonutItemsTable();

            console.log("Loading", sStatus);

        },

        onToggleChartSize: function () {

            var oCard = this.byId("_IDGenVBox1");
            var oButton = this.byId("chartExpandButton");

            if (!this._oChartDialog) {

                this._oChartDialog = new sap.m.Dialog({
                    contentWidth: "92%",
                    contentHeight: "85%",
                    stretch: false,
                    draggable: true,
                    resizable: true,
                    horizontalScrolling: false,
                    verticalScrolling: false
                });

                this.getView().addDependent(this._oChartDialog);

                this._oChartDialog.attachAfterClose(function () {

                    if (this._oOriginalChartParent) {

                        this._oOriginalChartParent.insertItem(
                            oCard,
                            this._iOriginalChartIndex
                        );

                        this.byId("barChart").setHeight("300px");

                        oButton.setIcon("sap-icon://full-screen");

                        this._bChartExpanded = false;
                    }

                }.bind(this));
            }

            if (!this._bChartExpanded) {

                this._oOriginalChartParent = oCard.getParent();

                this._iOriginalChartIndex =
                    this._oOriginalChartParent.indexOfItem(oCard);

                this._oOriginalChartParent.removeItem(oCard);

                this.byId("barChart").setHeight("620px");

                this._oChartDialog.removeAllContent();

                oCard.setWidth("100%");
                oCard.setHeight("100%");

                this.byId("barChart").setWidth("100%");
                this.byId("barChart").setHeight("650px");

                this._oChartDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");

                this._bChartExpanded = true;

                this._oChartDialog.open();

            } else {

                oCard.setWidth("68%");
                oCard.setHeight("440px");

                this.byId("barChart").setHeight("300px");
                this._oChartDialog.close();

            }

        },

        onToggleDonutSize: function () {

            var oCard = this.byId("_IDGenVBox2");
            var oButton = this.byId("donutExpandButton");
            var oDonutViewModel = this.getView().getModel("donutViewModel");

            if (!this._oDonutDialog) {

                this._oDonutDialog = new sap.m.Dialog({
                    contentWidth: "92%",
                    contentHeight: "85%",
                    stretch: false,
                    draggable: true,
                    resizable: true,
                    horizontalScrolling: false,
                    verticalScrolling: true
                });

                this.getView().addDependent(this._oDonutDialog);

                this._oDonutDialog.attachAfterClose(function () {

                    if (this._oOriginalDonutParent) {
                        this._oOriginalDonutParent.insertItem(oCard, this._iOriginalDonutIndex);
                    }

                    oCard.setWidth("30%");
                    oCard.setHeight("440px");

                    oButton.setIcon("sap-icon://full-screen");
                    oDonutViewModel.setProperty("/expanded", false);

                    this._bDonutExpanded = false;

                    sap.ui.core.Fragment.byId(
                        this.getView().getId(),
                        "btnDonutExport"

                    ).setVisible(false);

                }.bind(this));
            }

            if (!this._bDonutExpanded) {

                this._oOriginalDonutParent = oCard.getParent();
                this._iOriginalDonutIndex = this._oOriginalDonutParent.indexOfItem(oCard);
                this._oOriginalDonutParent.removeItem(oCard);

                oCard.setWidth("100%");
                oCard.setHeight("100%");

                this._oDonutDialog.removeAllContent();
                this._oDonutDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");
                oDonutViewModel.setProperty("/expanded", true);

                this._bDonutExpanded = true;
                sap.ui.core.Fragment.byId(
                    this.getView().getId(),
                    "btnDonutExport"

                ).setVisible(true);

                this._oDonutDialog.open();

            } else {
                this._oDonutDialog.close();
            }
        },

        onToggleTransactionSize: function () {

            var oCard = this.byId("_IDGenVBox3");
            var oButton = this.byId("transactionExpandButton");

            if (!this._oTransactionDialog) {

                this._oTransactionDialog = new sap.m.Dialog({

                    contentWidth: "95%",
                    contentHeight: "90%",
                    stretch: false,

                    draggable: true,
                    resizable: true,

                    horizontalScrolling: false,
                    verticalScrolling: false

                });

                this.getView().addDependent(this._oTransactionDialog);

                this._oTransactionDialog.attachAfterClose(function () {

                    this._oTransactionParent.insertItem(
                        oCard,
                        this._iTransactionIndex
                    );

                    oCard.setWidth("68%");

                    oButton.setIcon("sap-icon://full-screen");

                    this._bTransactionExpanded = false;

                }.bind(this));

            }

            if (!this._bTransactionExpanded) {

                this._oTransactionParent = oCard.getParent();

                this._iTransactionIndex =
                    this._oTransactionParent.indexOfItem(oCard);

                this._oTransactionParent.removeItem(oCard);

                oCard.setWidth("100%");

                this._oTransactionDialog.removeAllContent();

                this._oTransactionDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");

                this._bTransactionExpanded = true;

                this._oTransactionDialog.open();

            } else {

                this._oTransactionDialog.close();

            }

        },

        onExportTransactions: function () {

            var oTable = this.byId("_IDGenTable");
            var oBinding = oTable.getBinding("items");

            var aData = oBinding.getContexts().map(function (oContext) {
                return oContext.getObject();
            });

            var aColumns = [
                {
                    label: "Order Key",
                    property: "OrderKey",
                    type: "string"
                },
                {
                    label: "Processing Status",
                    property: "ProcessingStatus",
                    type: "string"
                },
                {
                    label: "Technical Status",
                    property: "TechnicalStatus",
                    type: "string"
                },
                {
                    label: "Created On",
                    property: "CreatedOn",
                    type: "date"
                },

                {
                    label: "Created By",
                    property: "CreatedBy",
                    type: "string"
                },
                {
                    label: "Released By",
                    property: "ReleasedBy",
                    type: "string"
                }
            ];

            var oSpreadsheet = new Spreadsheet({
                workbook: {
                    columns: aColumns
                },
                dataSource: aData,
                fileName: "Payment_Transactions.xlsx"
            });

            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });

        },

        onExportDonutItems: function () {

            var aItems = this.getView()
                .getModel("donutItemsModel")
                .getProperty("/items");

            if (!aItems || aItems.length === 0) {
                sap.m.MessageToast.show("No data available for export.");
                return;
            }

            var aCols = [
                {
                    label: "Item Number",
                    property: "ItemNumber",
                    type: "String"
                },
                {
                    label: "Created Date",
                    property: "PICreatedDate",
                    type: "String"
                },
                {
                    label: "Processing Status",
                    property: "ItemProcessingStatusText",
                    type: "String"
                },
                {
                    label: "Transaction Amount",
                    property: "PITransactionAmount",
                    type: "Number"
                },
                {
                    label: "Release Status",
                    property: "PIReleaseStatus",
                    type: "String"
                }
            ];

            var oSpreadsheet = new Spreadsheet({
                workbook: {
                    columns: aCols
                },
                dataSource: aItems,
                fileName: "Payment_Items.xlsx"
            });

            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });

        },

        onOpenTableSettings: function () {

            var that = this;
            var oColumnsModel = this.getView().getModel("tableColumnsModel");

            // Working copy so "Cancel" discards checkbox changes instead of applying them
            var aSelectedFields = oColumnsModel.getProperty("/visibleFields").slice();

            // Rebuild fresh each time so checkboxes always reflect the table's current state
            if (this._oSettingsDialog) {
                this._oSettingsDialog.destroy();
            }

            var oVBox = new sap.m.VBox({ class: "sapUiSmallMargin" });

            PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {

                oVBox.addItem(
                    new sap.m.CheckBox({
                        text: oFieldDef.label,
                        selected: aSelectedFields.indexOf(oFieldDef.key) > -1,

                        select: function (oEvent) {

                            var bSelected = oEvent.getParameter("selected");
                            var iIndex = aSelectedFields.indexOf(oFieldDef.key);

                            if (bSelected && iIndex === -1) {
                                aSelectedFields.push(oFieldDef.key);
                            } else if (!bSelected && iIndex > -1) {
                                aSelectedFields.splice(iIndex, 1);
                            }
                        }
                    })
                );
            });

            this._oSettingsDialog = new sap.m.Dialog({

                title: "Table Settings",
                contentWidth: "350px",
                contentHeight: "420px",

                content: [
                    new sap.m.ScrollContainer({
                        height: "100%",
                        width: "100%",
                        vertical: true,
                        horizontal: false,
                        content: [oVBox]
                    })
                ],

                beginButton: new sap.m.Button({
                    text: "OK",
                    press: function () {
                        oColumnsModel.setProperty("/visibleFields", aSelectedFields);
                        that._rebuildPaymentTable();
                        that._oSettingsDialog.close();
                    }
                }),

                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        that._oSettingsDialog.close();
                    }
                })
            });

            this.getView().addDependent(this._oSettingsDialog);
            this._oSettingsDialog.open();
        }
        ,

        onOpenDetailHeaderSettings: function () {

            var that = this;
            var oColumnsModel = this.getView().getModel("detailHeaderColumnsModel");

            // Working copy so "Cancel" discards checkbox changes
            var aSelectedFields = oColumnsModel.getProperty("/visibleFields").slice();

            if (this._oDetailHeaderSettingsDialog) {
                this._oDetailHeaderSettingsDialog.destroy();
            }

            var oVBox = new sap.m.VBox({ class: "sapUiSmallMargin" });

            PAYMENT_INFO_FIELD_CATALOG.forEach(function (oFieldDef) {

                oVBox.addItem(
                    new sap.m.CheckBox({
                        text: oFieldDef.label,
                        selected: aSelectedFields.indexOf(oFieldDef.key) > -1,

                        select: function (oEvent) {
                            var bSelected = oEvent.getParameter("selected");
                            var iIndex = aSelectedFields.indexOf(oFieldDef.key);

                            if (bSelected && iIndex === -1) {
                                aSelectedFields.push(oFieldDef.key);
                            } else if (!bSelected && iIndex > -1) {
                                aSelectedFields.splice(iIndex, 1);
                            }
                        }
                    })
                );
            });

            this._oDetailHeaderSettingsDialog = new sap.m.Dialog({

                title: "Select Fields",
                contentWidth: "350px",
                contentHeight: "420px",

                content: [
                    new sap.m.ScrollContainer({
                        height: "100%",
                        width: "100%",
                        vertical: true,
                        horizontal: false,
                        content: [oVBox]
                    })
                ],

                beginButton: new sap.m.Button({
                    text: "OK",
                    press: function () {
                        oColumnsModel.setProperty("/visibleFields", aSelectedFields);
                        that._rebuildPaymentDetailHeader(that._oCurrentDetailData);
                        that._oDetailHeaderSettingsDialog.close();
                    }
                }),

                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        that._oDetailHeaderSettingsDialog.close();
                    }
                })
            });

            this.getView().addDependent(this._oDetailHeaderSettingsDialog);
            this._oDetailHeaderSettingsDialog.open();
        },

        onOpenItemTableSettings: function () {

            var that = this;

            if (!this._oItemSettingsDialog) {

                this._oItemSettingsDialog = new sap.m.Dialog({
                    title: "Table Settings",
                    contentWidth: "450px",
                    contentHeight: "500px",
                    draggable: true,
                    resizable: true
                });

                var oList = new sap.m.List({
                    mode: "MultiSelect"
                });

                ITEM_DETAILS_FIELD_CATALOG.forEach(function (oField) {

                    oList.addItem(
                        new sap.m.StandardListItem({
                            title: oField.label
                        }).data("fieldKey", oField.key)
                    );

                });

                this._oItemSettingsDialog.addContent(oList);

                this._oItemSettingsDialog.setBeginButton(
                    new sap.m.Button({
                        text: "OK",
                        press: function () {

                            var aSelected = [];

                            oList.getSelectedItems().forEach(function (oItem) {
                                aSelected.push(oItem.data("fieldKey"));
                            });

                            that.getView()
                                .getModel("itemColumnsModel")
                                .setProperty("/visibleFields", aSelected);

                            that._rebuildItemTable();

                            that._oItemSettingsDialog.close();

                        }
                    })
                );

                this._oItemSettingsDialog.setEndButton(
                    new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oItemSettingsDialog.close();
                        }
                    })
                );
            }

            // Preselect current visible fields
            var aVisible = this.getView()
                .getModel("itemColumnsModel")
                .getProperty("/visibleFields");

            var oList = this._oItemSettingsDialog.getContent()[0];

            oList.removeSelections(true);

            oList.getItems().forEach(function (oItem) {

                if (aVisible.indexOf(oItem.data("fieldKey")) !== -1) {
                    oItem.setSelected(true);
                }

            });

            this._oItemSettingsDialog.open();

        },

        onExportItemDetails: function () {

            var aItems = this._oPaymentDialog
                .getModel("itemModel")
                .getProperty("/items") || [];

            if (!aItems.length) {
                sap.m.MessageToast.show("No data to export");
                return;
            }

            var aVisibleFields = this.getView()
                .getModel("itemColumnsModel")
                .getProperty("/visibleFields");

            var aColumns = [];

            aVisibleFields.forEach(function (sKey) {

                var oField = ITEM_DETAILS_FIELD_CATALOG.find(function (o) {
                    return o.key === sKey;
                });

                if (!oField) {
                    return;
                }

                aColumns.push({
                    label: oField.label,
                    property: oField.key,
                    type: "String"
                });

            });

            var oSpreadsheet = new Spreadsheet({

                workbook: {
                    columns: aColumns
                },

                dataSource: aItems,

                fileName: "Payment_Order_Items.xlsx"

            });

            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });

        },
        formatTechnicalStatusText: function (sStatus) {

            switch (sStatus) {

                // Successful
                case "31":
                case "34":
                    return sStatus + " - Successful";

                // Post Processing
                case "60":
                case "70":
                    return sStatus + " - Post Processing";

                // Pending
                case "15":
                case "17":
                case "18":
                case "20":
                case "22":
                case "23":
                case "29":
                case "30":
                case "35":
                case "37":
                case "39":
                case "77":
                case "79":
                    return sStatus + " - Pending";

                // Failed
                case "14":
                case "36":
                case "38":
                    return sStatus + " - Failed";

                // Rejected
                case "73":
                    return sStatus + " - Rejected";

                default:
                    return sStatus;
            }

        },

        formatOrderTechnicalStatusText: function (sStatus) {

            switch (sStatus) {

                case "128":
                case "130":
                case "230":
                case "270":

                    return sStatus + " - Successful";

                case "170":
                    return sStatus + " - Failed";

                case "172":
                case "173":
                    return sStatus + " - Rejected";

                case "39":
                case "35":
                case "37":
                case "110":
                case "115":
                case "117":
                case "118":
                case "119":
                case "120":
                case "176":
                case "177":
                case "178":
                case "179":
                case "180":
                case "101":
                case "103":
                case "105":
                    return sStatus + " - Pending";

                default:
                    return sStatus;
            }

        },

        _rebuildDonutItemsTable: function () {

            var oTable = this.byId("donutItemsTable");
            if (!oTable) return;

            var aVisibleFields = this.getView().getModel("donutItemsColumnsModel").getProperty("/visibleFields");
            var that = this;

            oTable.destroyColumns();
            oTable.unbindItems();

            aVisibleFields.forEach(function (sKey) {
                var oField = that._getItemFieldDef(sKey);
                oTable.addColumn(new sap.m.Column({
                    width: "9rem",
                    header: new sap.m.Text({ text: oField ? oField.label : sKey })
                }));
            });

            oTable.bindItems({
                path: "donutItemsModel>/items",
                factory: function () {

                    var aCells = [];

                    aVisibleFields.forEach(function (sKey) {
                        var oField = that._getItemFieldDef(sKey);

                        if (oField && oField.type === "date") {
                            aCells.push(new sap.m.Text({
                                text: {
                                    path: "donutItemsModel>" + sKey,
                                    type: "sap.ui.model.type.Date",
                                    formatOptions: { source: { pattern: "yyyy-MM-dd" }, style: "medium" }
                                }
                            }));
                        } else if (sKey === "ItemProcessingStatus") {
                            aCells.push(new sap.m.ObjectStatus({
                                text: { path: "donutItemsModel>ItemProcessingStatus", formatter: that.formatTechnicalStatusText },
                                state: { path: "donutItemsModel>ItemProcessingStatus", formatter: that.formatTechnicalStatusState }
                            }));
                        } else {
                            aCells.push(new sap.m.Text({ text: "{donutItemsModel>" + sKey + "}" }));
                        }
                    });

                    return new sap.m.ColumnListItem({ cells: aCells });
                }
            });
        },

        onOpenDonutTableSettings: function () {

            var that = this;

            if (!this._oDonutSettingsDialog) {

                this._oDonutSettingsDialog = new sap.m.Dialog({
                    title: "Table Settings",
                    contentWidth: "450px",
                    contentHeight: "500px",
                    draggable: true,
                    resizable: true
                });

                var oList = new sap.m.List({ mode: "MultiSelect" });

                ITEM_DETAILS_FIELD_CATALOG.forEach(function (oField) {
                    oList.addItem(new sap.m.StandardListItem({ title: oField.label }).data("fieldKey", oField.key));
                });

                this._oDonutSettingsDialog.addContent(oList);

                this._oDonutSettingsDialog.setBeginButton(new sap.m.Button({
                    text: "OK",
                    press: function () {
                        var aSelected = oList.getSelectedItems().map(function (i) { return i.data("fieldKey"); });
                        that.getView().getModel("donutItemsColumnsModel").setProperty("/visibleFields", aSelected);
                        that._rebuildDonutItemsTable();
                        that._oDonutSettingsDialog.close();
                    }
                }));

                this._oDonutSettingsDialog.setEndButton(new sap.m.Button({
                    text: "Cancel",
                    press: function () { that._oDonutSettingsDialog.close(); }
                }));
            }

            var aVisible = this.getView().getModel("donutItemsColumnsModel").getProperty("/visibleFields");
            var oList = this._oDonutSettingsDialog.getContent()[0];
            oList.removeSelections(true);
            oList.getItems().forEach(function (oItem) {
                if (aVisible.indexOf(oItem.data("fieldKey")) !== -1) oItem.setSelected(true);
            });

            this._oDonutSettingsDialog.open();
        },



        onVariantSave: function (oEvent) {
            var sName = oEvent.getParameter("name");

            // ✅ FIX: previously keyed storage by oVM.getCurrentVariantKey(), but
            // that's unreliable for brand-new variants — the sap.ui.fl framework
            // hasn't assigned the new variant's real key yet at the moment "save"
            // fires, so getCurrentVariantKey() was falling back to whatever variant
            // was active *before* the save (usually the Standard variant's own
            // control-id key). Result: new variants silently overwrote the Standard
            // slot's stored data instead of getting their own entry — confirmed by
            // the console log showing "id_..._flVariant" (the real new key) never
            // found, while "App-..." (the Standard key) held the just-saved data.
            //
            // Fix: store keyed by the variant's NAME, which is stable and known
            // immediately, and resolve name -> real key at select-time instead
            // (see onVariantSelect), via the control's own getVariants() list.
            if (!sName) {
                console.error("Variant save fired without a name — nothing to store.");
                return;
            }

            this._mVariants[sName] = {
                name: sName,
                clearingArea: this.getView().getModel("filterModel").getProperty("/clearingArea"),
                kpiDate: this.getView().getModel("filterModel").getProperty("/kpiDate"),
                transactionColumns: this.getView().getModel("tableColumnsModel").getProperty("/visibleFields"),
                itemColumns: this.getView().getModel("itemColumnsModel").getProperty("/visibleFields")
            };

            localStorage.setItem("PaymentDashboardVariants", JSON.stringify(this._mVariants));

            console.log("Saved Variant", sName, this._mVariants[sName]);
        },

        onVariantSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            var oVM = this.byId("variantManagement");

            // ✅ Resolve the framework's key back to the variant's display name —
            // our storage is keyed by name (see onVariantSave above), since the
            // framework's own generated keys aren't reliably known at save time.
            // getVariants() returns every variant currently known to the control,
            // including ones just created, as {key, title, ...}.
            var sName = sKey;
            var aVariants = (oVM && oVM.getVariants)
                ? oVM.getVariants()
                : [];

            console.log("All Variants", aVariants);

            aVariants.forEach(function (v) {

                console.log("Variant object", v);

                console.log("key", v.key);

                console.log("title", v.title);

                console.log("getKey", v.getKey && v.getKey());

                console.log("getTitle", v.getTitle && v.getTitle());

            });

            var oMatch = aVariants.find(function (o) {

                var sVariantKey =
                    o.getKey ? o.getKey() : o.key;

                return sVariantKey === sKey;

            });

            if (oMatch) {
                sName = oMatch.getTitle
                    ? oMatch.getTitle()
                    : oMatch.title;
            }

            var oVariants = JSON.parse(localStorage.getItem("PaymentDashboardVariants") || "{}");
            var oVariant = oVariants[sName];

            console.log("Selecting variant:", sKey, "-> name:", sName, "found:", oVariant);

            if (!oVariant) {
                return;
            }

            var oFilter = this.getView().getModel("filterModel");
            oFilter.setProperty("/clearingArea", oVariant.clearingArea);
            oFilter.setProperty("/kpiDate", oVariant.kpiDate);

            this.getView().getModel("tableColumnsModel").setProperty("/visibleFields", oVariant.transactionColumns);
            this.getView().getModel("itemColumnsModel").setProperty("/visibleFields", oVariant.itemColumns);

            this._rebuildPaymentTable();
            this._rebuildItemTable();

            // These two calls were missing — without them the KPI tiles/chart/donut
            // still show data for the OLD clearingArea/kpiDate even though the
            // filter bar controls now display the new values.
            this._loadKpiSummary();
            this._loadFlowChart();
            this._refreshExceptionKpis();
            this._refreshReconciliation();
            console.log("Loaded Variant", oVariant);
        },
_attachKpiCardClicks: function () {

    var aCardConfig = [
        { id: "_IDGenKpiTotal",    handler: this.onTotalProcessedPress },
        { id: "_IDGenKpiSuccess",  handler: this.onSuccessfulPaymentPress },
        { id: "_IDGenKpiPending",  handler: this.onPendingPaymentPress },
        { id: "_IDGenKpiFailed",   handler: this.onFailedPaymentPress },
        { id: "_IDGenKpiRejected", handler: this.onRejectedPaymentPress }
    ];

    aCardConfig.forEach(function (oConfig) {

        var oCard = this.byId(oConfig.id);
        if (!oCard) { return; }

        // ✅ Avoid double-binding on re-render
        if (oCard.data("clickBound")) { return; }

        oCard.attachBrowserEvent("click", oConfig.handler, this);
        oCard.data("clickBound", true);

    }.bind(this));

},


// ✅ Shared text formatter for all 5 Overview KPI trends — empty string
// when there's no prior-day data (tile shows nothing, per your requirement).
formatKpiTrendText: function (oTrend) {

    if (!oTrend || !oTrend.hasData) {
        return "";
    }

    if (oTrend.direction === "flat") {
        return "No change vs yesterday";
    }

    var sArrow = oTrend.direction === "up" ? "+" : "-";

    return sArrow + oTrend.percent.toFixed(1) + "% vs yesterday";

},

// ✅ Shared class formatter — colors the subtext based on whether the
// direction is "good" or "bad" for that specific KPI's semantic.
formatKpiTrendClass: function (oTrend) {

    if (!oTrend || !oTrend.hasData || oTrend.direction === "flat" || oTrend.semantic === "neutral") {
        return "kpiCardSubtext";
    }

    var bIsGood = (oTrend.semantic === "goodUp" && oTrend.direction === "up") ||
                  (oTrend.semantic === "badUp" && oTrend.direction === "down");

    return bIsGood
        ? "kpiCardSubtext kpiCardSubtextGood"
        : "kpiCardSubtext kpiCardSubtextWarn";

},


    });

});