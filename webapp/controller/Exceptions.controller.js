sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (Controller, JSONModel, Filter, FilterOperator, FlattenedDataset, FeedItem) {
    "use strict";

    // ✅ Chart-type switcher for the Exception Trend chart — full parity with
    // CHART_TYPE_CONFIG in View1.controller.js. "mode" decides which dataset
    // shape the chart needs when that type is picked:
    //   - "axis"  : Bar/Column/Line/Stacked variants — Day dimension,
    //               Opened+Resolved measures (same shape as today).
    //   - "share" : Pie/Donut — part-to-whole, so the Day dimension is
    //               dropped in favor of totals: Opened total vs Resolved
    //               total across the whole trend window.
    //   - "heatmap": Day √ó Type (Opened/Resolved) grid, colored by count.
    var TREND_CHART_TYPE_CONFIG = {
        bar: { vizType: "bar", label: "Bar Chart", icon: "sap-icon://horizontal-bar-chart-2", mode: "axis" },
        column: { vizType: "column", label: "Column Chart", icon: "sap-icon://vertical-bar-chart", mode: "axis" },
        line: { vizType: "line", label: "Line Chart", icon: "sap-icon://line-chart", mode: "axis" },
        pie: { vizType: "pie", label: "Pie Chart", icon: "sap-icon://pie-chart", mode: "share" },
        donut: { vizType: "donut", label: "Donut Chart", icon: "sap-icon://donut-chart", mode: "share" },
        heatmap: { vizType: "heatmap", label: "Heat Map", icon: "sap-icon://heatmap-chart", mode: "heatmap" },
        stacked_bar: { vizType: "stacked_bar", label: "Stacked Bar Chart", icon: "sap-icon://horizontal-bar-chart", mode: "axis" },
        stacked_column: { vizType: "stacked_column", label: "Stacked Column Chart", icon: "sap-icon://vertical-bar-chart-2", mode: "axis" },
        "100_stacked_bar": { vizType: "100_stacked_bar", label: "100% Stacked Bar Chart", icon: "sap-icon://full-stacked-chart", mode: "axis" },
        "100_stacked_column": { vizType: "100_stacked_column", label: "100% Stacked Column Chart", icon: "sap-icon://full-stacked-column-chart", mode: "axis" }
    };

    // ✅ "By Rail" chart-type switcher — same menu-button pattern as
    // TREND_CHART_TYPE_CONFIG, just two options since the pie chart and
    // progress bars share the exact same railModel>/data (status + value +
    // percent), so switching is pure visibility toggling — no dataset rebuild
    // needed (see onRailChartTypeSelected).


    return Controller.extend("payment.dashboard.controller.Exception", {

        onInit: function () {

            // ✅ Open Exceptions / Value at Risk KPI tiles — bound to the ExceptionKPI
            // OData entity set, filtered by the shared ClearingArea/Date filter
            // (same filterModel the Overview tab's header filter bar writes to).
            // Defaults to 0 until the first read completes; see loadExceptionKpis.
            var oExceptionKpiModel = new JSONModel({
                OpenException: 0,
                ValueAtRisk: 0,
                openExceptionTrend: { percent: 0, direction: "flat", hasData: false },
                valueAtRiskTrend: { percent: 0, direction: "flat", hasData: false }
            });
            this.getView().setModel(oExceptionKpiModel, "exceptionKpiModel");

            // ✅ "Exception Reasons" card — top 5 rows, grouped from the
            // ExceptionsByReason OData entity set. Empty until the first read
            // completes; see loadExceptionReasons.
            var oReasonModel = new JSONModel({
                topReasons: [],
                criticalTotal: 0
            });
            this.getView().setModel(oReasonModel, "reasonModel");

            var oTrendModel = new JSONModel({
                data: []
            });
            this.getView().setModel(oTrendModel, "trendModel");

            // ✅ "By Rail" pie chart — live from the RailKpi OData entity set,
            // filtered by ClearingArea + PaymentItemDate (same shared
            // filterModel the Overview tab's header filter bar writes to).
            // Empty until the first read completes; see loadRailKpi.
            var oRailModel = new JSONModel({
                data: [],
                total: 0,
                totalText: ""
            });
            this.getView().setModel(oRailModel, "railModel");

            // ✅ "By Rail" chart-type toggle — pie vs. progress bar. Controls
            // which of the two visualizations (bound to the same railModel
            // data) is visible; see onRailChartTypeMenuPress.
            var oRailViewModel = new JSONModel({
                chartType: "pie"
            });
            this.getView().setModel(oRailViewModel, "railViewModel");

            // Initial load — uses the shared filterModel if the parent view has
            // already set it, otherwise falls back to defaults inside
            // loadExceptionKpis itself. View1.controller.js also re-triggers this
            // on every Clearing Area / Date change via _refreshExceptionKpis().
            this.loadExceptionKpis();
            this.loadExceptionReasons();
            this.loadExceptionTrend();
            this.loadRailKpi();
            this._attachKpiCardClicks();

            var oApprovalModel = new JSONModel({
                data: [
                    {
                        ref: "SARIE-260522-008142",
                        rail: "SARIE",
                        customer: "Ministry of Finance",
                        amount: "SAR 86,000,000",
                        age: "3h 02m",
                        status: "Open",
                        reason: "Mid-month disbursement > SAR 50M"
                    },
                    {
                        ref: "SARIE-260522-008231",
                        rail: "SARIE",
                        customer: "Ministry of Education",
                        amount: "SAR 24,000,000",
                        age: "1h 44m",
                        status: "Open",
                        reason: "Country Risk - False Positive"
                    },
                    {
                        ref: "WPS-260522-MOI-031",
                        rail: "WPS",
                        customer: "Ministry of Interior",
                        amount: "SAR 8,280,000",
                        age: "12m",
                        status: "Rejected",
                        reason: "Name Match - UN Consolidated List"
                    }
                ]
            });

            var oPostProcessingModel = new JSONModel({
                data: [
                    {
                        ref: "SARIE-260522-008402",
                        rail: "SARIE",
                        customer: "GOSI",
                        amount: "SAR 18,400,000",
                        age: "58m",
                        status: "Rejected",
                        reason: "Settlement ACK Pending - Queued"
                    },
                    {
                        ref: "SARIE-260522-008411",
                        rail: "SARIE",
                        customer: "Saudi Customs",
                        amount: "SAR 4,800,000",
                        age: "42m",
                        status: "Rejected",
                        reason: "Settlement ACK Pending - Queued"
                    },
                    {
                        ref: "SARIE-260522-008455",
                        rail: "SARIE",
                        customer: "ZATCA refund - TXN-99214",
                        amount: "SAR 412,000",
                        age: "8m",
                        status: "Rejected",
                        reason: "Settlement ACK Pending - Queued"
                    }
                ]
            });

            this.getView().setModel(
                oPostProcessingModel,
                "postProcessingModel"
            );


            var oRejectedModel = new JSONModel({
                data: [
                    {
                        ref: "MT103-260522-014008",
                        rail: "SWIFT",
                        customer: "Saudi Binladin Group",
                        amount: "SAR 1,026,400",
                        age: "6h 44m",
                        status: "Rejected",
                        reason: "Invalid intermediary BIC - NAK"
                    },
                    {
                        ref: "WPS-260522-AMR-027",
                        rail: "WPS",
                        customer: "Almarai - 1 Employee",
                        amount: "SAR 18,400",
                        age: "4h 12m",
                        status: "Rejected",
                        reason: "IBAN Mismatch ‚Äî Employee Record"
                    },
                    {
                        ref: "SARIE-260522-007988",
                        rail: "SARIE",
                        customer: "Retail - TXN-RET-90412",
                        amount: "SAR 4,800",
                        age: "1h 02m",
                        status: "Post-Processing",
                        reason: "Beneficiary Account Closed"
                    }
                ]
            });

            this.getView().setModel(
                oRejectedModel,
                "rejectedModel"
            );


            this.getView().setModel(oApprovalModel, "approvalModel");

            this._createInfoModel(
                oApprovalModel.getProperty("/data"),
                "approvalInfoModel"
            );

            this._createInfoModel(
                oPostProcessingModel.getProperty("/data"),
                "postProcessingInfoModel"
            );

            this._createInfoModel(
                oRejectedModel.getProperty("/data"),
                "rejectedInfoModel"
            );

            var oRailSelect = this.byId("filterRail");

            oRailSelect.addItem(
                new sap.ui.core.Item({
                    key: "ALL",
                    text: "All"
                })
            );

            oRailSelect.addItem(
                new sap.ui.core.Item({
                    key: "SARIE",
                    text: "SARIE"
                })
            );

            oRailSelect.addItem(
                new sap.ui.core.Item({
                    key: "SWIFT",
                    text: "SWIFT"
                })
            );

            oRailSelect.addItem(
                new sap.ui.core.Item({
                    key: "WPS",
                    text: "WPS"
                })
            );


            var oStatusSelect = this.byId("filterStatus");

            oStatusSelect.addItem(
                new sap.ui.core.Item({
                    key: "ALL",
                    text: "All"
                })
            );

            oStatusSelect.addItem(
                new sap.ui.core.Item({
                    key: "OPEN",
                    text: "Open"
                })
            );

            oStatusSelect.addItem(
                new sap.ui.core.Item({
                    key: "PROCESSING",
                    text: "Processing"
                })
            );

            oStatusSelect.addItem(
                new sap.ui.core.Item({
                    key: "REJECTED",
                    text: "Rejected"
                })
            );

            var oGovExceptionsModel = new JSONModel({
                data: [
                    {
                        entity: "Ministry of Finance",
                        rail: "SARIE",
                        open: 18,
                        value: "86.0M",
                        note: "Mid-month disbursement",
                        aged: "3h 02m",
                        status: "Action Needed",
                        statusColor: "Warning"
                    },
                    {
                        entity: "GOSI",
                        rail: "SARIE",
                        open: 12,
                        value: "24.4M",
                        note: "Settlement ACK pending",
                        aged: "58m",
                        status: "Awaiting",
                        statusColor: "Information"
                    },
                    {
                        entity: "Ministry of Education",
                        rail: "SARIE",
                        open: 8,
                        value: "24.0M",
                        note: "Payroll batch approval",
                        aged: "1h 44m",
                        status: "Action Needed",
                        statusColor: "Warning"
                    },
                    {
                        entity: "Ministry of Interior",
                        rail: "WPS",
                        open: 4,
                        value: "8.3M",
                        note: "Threshold approval",
                        aged: "12m",
                        status: "Action Needed",
                        statusColor: "Warning"
                    },
                    {
                        entity: "Saudi Customs",
                        rail: "SARIE",
                        open: 3,
                        value: "4.8M",
                        note: "VAT refund ACK pending",
                        aged: "42m",
                        status: "Awaiting",
                        statusColor: "Information"
                    },
                    {
                        entity: "Public Investment Fund",
                        rail: "SWIFT",
                        open: 2,
                        value: "142.0M",
                        note: "Beneficiary screening hold",
                        aged: "4h 18m",
                        status: "Escalated",
                        statusColor: "Error"
                    }
                ]
            });

            this.getView().setModel(
                oGovExceptionsModel,
                "govExceptionsModel"
            );




            var oOpenExceptionModel = new JSONModel({
                data: [],
                total: 0,
                maxAge: "",
                maxAmount: ""
            });

            this.getView().setModel(
                oOpenExceptionModel,
                "openExceptionModel"
            );

            var oStartupInfoModel = new JSONModel({
                total: 0,
                maxAge: "",
                maxAmount: ""
            });

            this.getView().setModel(
                oStartupInfoModel,
                "startupInfoModel"
            );



            var oWpsExceptionModel = new JSONModel({
                data: [
                    {
                        programme: "Ministry of Education",
                        employees: 42,
                        amount: "SAR 2,104,000",
                        reason: "Account closed - CR update pending",
                        aged: "32m",
                        agedState: "None"
                    },
                    {
                        programme: "Aramco Trading Company",
                        employees: 8,
                        amount: "SAR 384,000",
                        reason: "Insufficient funds in salary account",
                        aged: "1h 04m",
                        agedState: "Warning"
                    },
                    {
                        programme: "Saudi Telecom Company (STC)",
                        employees: 3,
                        amount: "SAR 142,000",
                        reason: "IBAN mismatch ‚Äî employee record",
                        aged: "44m",
                        agedState: "None"
                    },
                    {
                        programme: "Almarai Company",
                        employees: 1,
                        amount: "SAR 18,400",
                        reason: "Sanctions hit - false-positive review",
                        aged: "12m",
                        agedState: "None"
                    },
                    {
                        programme: "Ministry of Interior - Allowance",
                        employees: 184,
                        amount: "SAR 8,280,000",
                        reason: "Batch awaiting 4-eyes approval",
                        aged: "8m",
                        agedState: "None"
                    },
                    {
                        programme: "Saudi Binladin Group",
                        employees: 22,
                        amount: "SAR 1,026,400",
                        reason: "Off-cycle batch - verify with HR",
                        aged: "2h 12m",
                        agedState: "Error"
                    },
                    {
                        programme: "Bahri Maritime",
                        employees: 6,
                        amount: "SAR 312,000",
                        reason: "GOSI registration expired",
                        aged: "1h 38m",
                        agedState: "Warning"
                    }
                ]
            });

            this.getView().setModel(
                oWpsExceptionModel,
                "wpsExceptionModel"
            );


            var oTeamWorkloadModel = new JSONModel({
                data: [
                    {
                        operator: "Anna Al-Becker",
                        role: "Team Lead",
                        assigned: 142,
                        resolved: 312,
                        sla: 2,
                        util: 84,
                        status: "Available"
                    },
                    {
                        operator: "Faisal Al-Otaibi",
                        role: "Sr. Ops",
                        assigned: 118,
                        resolved: 264,
                        sla: 1,
                        util: 92,
                        status: "On Case"
                    },
                    {
                        operator: "Reem Al-Shahrani",
                        role: "Ops",
                        assigned: 96,
                        resolved: 218,
                        sla: 0,
                        util: 89,
                        status: "On Case"
                    }
                ]
            });

            this.getView().setModel(
                oTeamWorkloadModel,
                "teamWorkloadModel"
            );




            var oEscalationModel = new JSONModel({
                data: [
                    {
                        title: "PF ¬∑ SWIFT screening hit",
                        details: "MT103-260522-014288 ¬∑ Compliance Hold ¬∑ 1h 42m ago",
                        amount: "SAR 142,000,000"

                    },
                    {
                        title: "MoF ¬∑ Disbursement above limit",
                        details: "SARIE-260522-008142 ¬∑ Operations Hold ¬∑ 32m ago",
                        amount: "SAR 86,000,000"
                    },
                    {
                        title: "MoI hardship allowance ¬∑ eligibility",
                        details: "WPS-260522-MOI-031 ¬∑ WPS Compliance ¬∑ 12m ago",
                        amount: "SAR 8,280,000"
                    },
                    {
                        title: "Binladin Group ¬∑ NAK - Invalid BIC",
                        details: "MT103-260522-014008 ¬∑ SWIFT Operations ¬∑ 4h 22m ago",
                        amount: "SAR 1,026,400"
                    },
                    {
                        title: "End-of-day mismatch - GOSI",
                        details: "SARIE-260522-007982 ¬∑ Reconciliation ¬∑ 8m ago",
                        amount: "SAR 412,000"
                    }
                ]
            });



            this.getView().setModel(
                oEscalationModel,
                "escalationModel"
            );






        },

        formatExceptionStatus: function (sStatus) {

            if (!sStatus) {
                return "None";
            }

            switch (sStatus.toUpperCase()) {

                case "OPEN":
                    return "Warning";

                case "PROCESSING":
                    return "Information";

                case "REJECTED":
                    return "Error";

                case "RESOLVED":
                    return "Success";

                default:
                    return "None";
            }
        }
        ,

        formatGovStatusIcon: function (sStatus) {

            switch (sStatus) {

                case "Action Needed":
                    return "sap-icon://alert";

                case "Awaiting":
                    return "sap-icon://information";

                case "Escalated":
                    return "sap-icon://decline";

                default:
                    return "";
            }
        },

        formatGovStatusState: function (sStatus) {

            switch (sStatus) {

                case "Action Needed":
                    return "Warning";

                case "Awaiting":
                    return "Information";

                case "Escalated":
                    return "Error";

                default:
                    return "None";
            }
        },

        formatWorkloadStatus: function (sStatus) {

            switch (sStatus) {

                case "Available":
                    return "Success";

                case "On Case":
                    return "Information";

                case "Busy":
                    return "Warning";

                default:
                    return "None";
            }
        },

        formatAgeState: function (sAge, sMaxAge) {

            if (!sAge || !sMaxAge) {
                return "None";
            }

            return sAge === sMaxAge ? "Error" : "None";
        },

        formatRailBadge: function (sRail) {

            if (sRail === "SWIFT") {
                return "<span class='railSwift'>SWIFT</span>";
            }

            if (sRail === "SARIE") {
                return "<span class='railSarie'>SARIE</span>";
            }

            if (sRail === 'WPS') {
                return "<span class='railWps'>WPS</span>";
            }

            return sRail;
        }
        ,

        onGlobalSearch: function (oEvent) {

            var sQuery =
                oEvent.getParameter("newValue") || "";

            var oTable = this.byId("_IDGenTable4");   // ‚úÖ FIXED
            var oBinding = oTable.getBinding("items");

            if (!sQuery) {
                oBinding.filter([]);
                this._updateVisibleCount(oBinding);
                return;
            }

            var aFilters = [
                new sap.ui.model.Filter("ref", "Contains", sQuery),
                new sap.ui.model.Filter("customer", "Contains", sQuery),
                new sap.ui.model.Filter("amount", "Contains", sQuery),
                new sap.ui.model.Filter("reason", "Contains", sQuery),
                new sap.ui.model.Filter("rail", "Contains", sQuery)   // ‚úÖ added
            ];

            var oFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false   // ‚úÖ OR condition
            });

            oBinding.filter(oFilter);
            this.onFilterChange();
        },

        onFilterChange: function () {

            var aFilters = [];

            /*
             * OBJECT CATEGORY
             */
            var oObjectCategory =
                this.byId("filterObjectCategory");

            var sObjectCategory =
                oObjectCategory
                    ? oObjectCategory.getSelectedKey()
                    : "ALL_OBJECT_CATEGORY";

            /*
             * STATUS
             */
            var sStatus =
                this.byId("filterStatus")
                    .getSelectedKey();

            /*
             * AGING
             */
            var sAging =
                this.byId("filterAging")
                    .getSelectedKey();

            /*
             * REASON
             */
            var sReason =
                this.byId("_IDGenInput")
                    ? this.byId("_IDGenInput").getValue()
                    : "";

            /*
             * GLOBAL SEARCH
             */
            var sSearch =
                this.byId("_IDGenSearchField1")
                    ? this.byId("_IDGenSearchField1").getValue()
                    : "";


            /*
             * OBJECT CATEGORY
             * Actual field:
             * ObjectCategory
             */
            if (
                sObjectCategory &&
                sObjectCategory !== "ALL_OBJECT_CATEGORY"
            ) {

                aFilters.push(
                    new sap.ui.model.Filter(
                        "ObjectCategory",
                        sap.ui.model.FilterOperator.EQ,
                        sObjectCategory
                    )
                );
            }


            /*
             * STATUS
             * Actual field:
             * Status
             */
            if (
                sStatus &&
                sStatus !== "ALL"
            ) {

                aFilters.push(
                    new sap.ui.model.Filter(
                        "Status",
                        sap.ui.model.FilterOperator.EQ,
                        sStatus
                    )
                );
            }


            /*
             * AGING
             * Actual field:
             * Aged
             */
            if (
                sAging &&
                sAging !== "ALL_AGE"
            ) {

                aFilters.push(
                    new sap.ui.model.Filter(
                        "Aged",
                        sap.ui.model.FilterOperator.EQ,
                        sAging
                    )
                );
            }


            /*
             * REASON
             * Actual field:
             * ReasonDetail
             */
            if (sReason) {

                aFilters.push(
                    new sap.ui.model.Filter(
                        "ReasonDetail",
                        sap.ui.model.FilterOperator.Contains,
                        sReason
                    )
                );
            }


            /*
             * GLOBAL SEARCH
             *
             * Search across the actual
             * EXCEPTIONDetail fields.
             */
            if (sSearch) {

                var oSearchFilter =
                    new sap.ui.model.Filter({
                        filters: [

                            new sap.ui.model.Filter(
                                "Reference",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "CounterParty",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "Amount",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "ReasonDetail",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "ObjectCategory",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "Aged",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            ),

                            new sap.ui.model.Filter(
                                "PaymentItemNumber",
                                sap.ui.model.FilterOperator.Contains,
                                sSearch
                            )

                        ],

                        /*
                         * Search fields use OR
                         */
                        and: false
                    });

                /*
                 * Search filter is combined with
                 * dropdown filters using AND.
                 */
                aFilters.push(oSearchFilter);
            }


            /*
             * APPLY ONLY TO OPEN EXCEPTIONS TABLE
             */
            var oTable =
                this.byId("_IDGenTable3");

            if (!oTable) {
                return;
            }

            var oBinding =
                oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            oBinding.filter(aFilters);

            /*
             * Update total visible rows
             */
            this._updateOpenExceptionCount(oBinding);
        },

        onToggleManager: function () {
            var oContent = this.byId("managerContent");
            var oButton = this.byId("managerHeader");
            var bVisible = oContent.getVisible();

            oContent.setVisible(!bVisible);

            oButton.setIcon(
                bVisible
                    ? "sap-icon://slim-arrow-right"
                    : "sap-icon://slim-arrow-down"
            );
        },

        _populateFilterDropdowns: function () {

            var oModel =
                this.getView()
                    .getModel("openExceptionModel");

            if (!oModel) {
                return;
            }

            var aData =
                oModel.getProperty("/data") || [];


            /*
             * OBJECT CATEGORY
             */
            var aObjectCategory = [
                ...new Set(
                    aData
                        .map(function (oRow) {
                            return oRow.ObjectCategory;
                        })
                        .filter(Boolean)
                )
            ];


            /*
             * STATUS
             */
            var aStatus = [
                ...new Set(
                    aData
                        .map(function (oRow) {
                            return oRow.Status;
                        })
                        .filter(function (sValue) {
                            return sValue !== null &&
                                sValue !== undefined &&
                                sValue !== "";
                        })
                )
            ];


            /*
             * AGED
             */
            var aAging = [
                ...new Set(
                    aData
                        .map(function (oRow) {
                            return oRow.Aged;
                        })
                        .filter(Boolean)
                )
            ];


            var oObjectCategory =
                this.byId("filterObjectCategory");

            var oStatus =
                this.byId("filterStatus");

            var oAging =
                this.byId("filterAging");


            /*
             * Clear old/static values
             */
            oObjectCategory.removeAllItems();
            oStatus.removeAllItems();
            oAging.removeAllItems();


            /*
             * OBJECT CATEGORY
             */
            oObjectCategory.addItem(
                new sap.ui.core.Item({
                    key: "ALL_OBJECT_CATEGORY",
                    text: "All"
                })
            );

            aObjectCategory.forEach(function (sValue) {

                oObjectCategory.addItem(
                    new sap.ui.core.Item({
                        key: sValue,
                        text: sValue
                    })
                );

            });


            /*
             * STATUS
             */
            oStatus.addItem(
                new sap.ui.core.Item({
                    key: "ALL",
                    text: "All"
                })
            );

            aStatus.forEach(function (sValue) {

                oStatus.addItem(
                    new sap.ui.core.Item({
                        key: sValue,
                        text: sValue
                    })
                );

            });


            /*
             * AGING
             */
            oAging.addItem(
                new sap.ui.core.Item({
                    key: "ALL_AGE",
                    text: "All Age"
                })
            );

            aAging.forEach(function (sValue) {

                oAging.addItem(
                    new sap.ui.core.Item({
                        key: sValue,
                        text: sValue
                    })
                );

            });
        },

        _calculateStartupInfo: function () {

            var aData = this.getView().getModel("startupModel").getProperty("/data");

            if (!aData || aData.length === 0) return;

            // ‚úÖ TOTAL
            var iTotal = aData.length;

            // ‚úÖ MAX AGE
            var fnToMinutes = function (ageStr) {
                var hours = 0, mins = 0;

                if (ageStr.includes("h")) {
                    hours = parseInt(ageStr.split("h")[0]) || 0;
                }

                if (ageStr.includes("m")) {
                    mins = parseInt(ageStr.split("h")[1]) || 0;
                }

                return (hours * 60) + mins;
            };


            var oMaxAge = aData[0];

            // ‚úÖ MAX AMOUNT
            var fnAmountToNumber = function (amountStr) {
                // "SAR 142M" ‚Üí 142000000
                var num = parseFloat(amountStr.replace(/[^\d.]/g, "")) || 0;

                if (amountStr.includes("M")) return num * 1000000;
                if (amountStr.includes("K")) return num * 1000;

                return num;
            };



            var oMaxAmount = aData[0];

            aData.forEach(function (item) {

                // ‚úÖ Check max age
                if (fnToMinutes(item.age) > fnToMinutes(oMaxAge.age)) {
                    oMaxAge = item;
                }

                // ‚úÖ Check max amount
                if (fnAmountToNumber(item.amount) > fnAmountToNumber(oMaxAmount.amount)) {
                    oMaxAmount = item;
                }
            });

            // ‚úÖ SET MODEL
            var oInfoModel = new JSONModel({
                total: iTotal,
                maxAge: oMaxAge.age,
                maxAmount: oMaxAmount.amount
            });

            this.getView().setModel(oInfoModel, "startupInfoModel");

        },

        _createInfoModel: function (aData, sModelName) {

            var iMaxAmount = 0;
            var sMaxAge = "";

            function ageToMinutes(sAge) {

                var iMinutes = 0;

                if (sAge.includes("h")) {

                    var aParts = sAge.split("h");

                    iMinutes += parseInt(aParts[0]) * 60;

                    if (aParts[1]) {
                        iMinutes += parseInt(aParts[1]);
                    }

                } else {

                    iMinutes += parseInt(sAge);
                }

                return iMinutes;
            }

            aData.forEach(function (oItem) {

                var iAmount = Number(
                    oItem.amount
                        .replace("SAR", "")
                        .replace(/,/g, "")
                        .replace("M", "000000")
                        .trim()
                );

                if (iAmount > iMaxAmount) {
                    iMaxAmount = iAmount;
                }

                if (
                    !sMaxAge ||
                    ageToMinutes(oItem.age) > ageToMinutes(sMaxAge)
                ) {
                    sMaxAge = oItem.age;
                }

            });

            this.getView().setModel(
                new JSONModel({
                    total: aData.length,
                    maxAmount: "SAR " + iMaxAmount.toLocaleString(),
                    maxAge: sMaxAge
                }),
                sModelName
            );
        }

        ,

        _applyFiltersToOpenExceptionTable: function (aFilters) {

            var oTable =
                this.byId("_IDGenTable3");

            if (!oTable) {
                return;
            }

            var oBinding =
                oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            oBinding.filter(aFilters);

            /*
             * Update visible row count after filtering
             */
            var iVisibleCount =
                oBinding.getLength();

            console.log(
                "Visible exception rows:",
                iVisibleCount
            );
        },

        // ✅ Public — called on initial load and again whenever the header's
        // Clearing Area / Date filter changes (View1.controller.js calls this
        // through this.byId("ExceptionsView").getController()). Reads the
        // ExceptionKPI OData entity set filtered to the current ClearingArea +
        // PaymentOrderDate and pushes OpenException/ValueAtRisk into the two
        // KPI tiles. Falls back to today's date / DEBNKC if the shared
        // filterModel isn't available yet (defensive — nested view init order
        // isn't guaranteed relative to the parent's).
        loadExceptionKpis: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this.getView().getModel("filterModel");

            var sClearingArea = oFilterModel
                ? oFilterModel.getProperty("/clearingArea")
                : "DEBNKC";

            var sDate = oFilterModel
                ? oFilterModel.getProperty("/kpiDate")
                : new Date().toISOString().slice(0, 10);

            var oExceptionKpiModel = this.getView().getModel("exceptionKpiModel");

            if (!oODataModel || !sClearingArea || !sDate) {
                return;
            }

            var sPreviousDate = this._getPreviousDateStr(sDate);

            var fnReadKpiForDate = function (sTargetDate) {

                var aFilters = [
                    new Filter("clearingarea", FilterOperator.EQ, sClearingArea),
                    new Filter("paymentorderdate", FilterOperator.EQ, sTargetDate)
                ];

                var oListBinding = oODataModel.bindList("/ExceptionKPI", undefined, undefined, aFilters, {
                    $select: "clearingarea,paymentorderdate,OpenException,ValueAtRisk"
                });

                return oListBinding.requestContexts(0, 1).then(function (aContexts) {

                    if (!aContexts.length) {
                        return { OpenException: 0, ValueAtRisk: 0 };
                    }

                    var oRow = aContexts[0].getObject();

                    return {
                        OpenException: oRow.OpenException || 0,
                        ValueAtRisk: oRow.ValueAtRisk || 0
                    };

                }).catch(function (oError) {
                    console.error("Exception KPI load failed for", sTargetDate, oError);
                    return { OpenException: 0, ValueAtRisk: 0 };
                });

            };

            Promise.all([
                fnReadKpiForDate(sDate),
                fnReadKpiForDate(sPreviousDate)
            ]).then(function (aResults) {

                var oToday = aResults[0];
                var oYesterday = aResults[1];

                oExceptionKpiModel.setData({
                    OpenException: oToday.OpenException,
                    ValueAtRisk: oToday.ValueAtRisk,
                    openExceptionTrend: this._computeTrend(oToday.OpenException, oYesterday.OpenException),
                    valueAtRiskTrend: this._computeTrend(oToday.ValueAtRisk, oYesterday.ValueAtRisk)
                });

            }.bind(this));

        },

        // ✅ Returns "YYYY-MM-DD" for the day before sDate, using local date math
        // (not toISOString()) to avoid the UTC-shift issues already flagged
        // elsewhere in this controller (loadOpenExceptionDetails, loadExceptionTrend).
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

        // ✅ Computes % change from fPrevious → fCurrent. "hasData" is false when
        // yesterday had zero (no meaningful % to show), so the UI can fall back to
        // a plain label instead of a nonsensical "+∞%" or "+100%".
        _computeTrend: function (fCurrent, fPrevious) {

            if (!fPrevious || fPrevious === 0) {
                return {
                    percent: 0,
                    direction: fCurrent > 0 ? "up" : "flat",
                    hasData: false
                };
            }

            var fPercent = ((fCurrent - fPrevious) / fPrevious) * 100;

            return {
                percent: Math.abs(fPercent),
                direction: fPercent > 0 ? "up" : (fPercent < 0 ? "down" : "flat"),
                hasData: true
            };

        },

        loadOpenExceptionDetails: function () {

            var oOpenExceptionModel =
                this.getView().getModel("openExceptionModel");

            var oFilterModel =
                this.getView().getModel("filterModel");

            if (!oOpenExceptionModel) {
                console.error("openExceptionModel not found");
                return;
            }

            var sClearingArea = oFilterModel
                ? oFilterModel.getProperty("/clearingArea")
                : "DEBNKC";

            var sSelectedDate = oFilterModel
                ? oFilterModel.getProperty("/kpiDate")
                : null;

            if (!sSelectedDate) {
                console.warn(
                    "Open Exception Detail: selected date missing"
                );
                return;
            }

            /*
             * Convert selected date to YYYY-MM-DD.
             * Do NOT use toISOString() because it can shift the
             * business date by one day in IST.
             */
            var sDate;

            if (sSelectedDate instanceof Date) {

                sDate =
                    sSelectedDate.getFullYear() +
                    "-" +
                    String(
                        sSelectedDate.getMonth() + 1
                    ).padStart(2, "0") +
                    "-" +
                    String(
                        sSelectedDate.getDate()
                    ).padStart(2, "0");

            } else {

                sDate =
                    String(sSelectedDate)
                        .slice(0, 10);
            }

            console.log(
                "Loading EXCEPTIONDetail for:",
                sClearingArea,
                sDate
            );

            /*
             * Clear table before loading.
             */
            oOpenExceptionModel.setProperty(
                "/data",
                []
            );

            /*
             * OData V4 URL.
             *
             * IMPORTANT:
             * We intentionally use fetch() instead of
             * oDataModel.bindList().
             *
             * The backend currently contains duplicate OData
             * keys. OData V4's cache rejects those duplicates.
             * fetch() allows us to receive the raw response.
             */

            var sServiceUrl =
                "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/";

            var sFilter =
                "ClearingArea eq '" +
                encodeURIComponent(sClearingArea).replace(/'/g, "%27") +
                "' and PaymentItemDate eq " +
                sDate;

            var sUrl =
                sServiceUrl +
                "EXCEPTIONDetail" +
                "?$filter=" +
                sFilter +
                "&$select=" +
                [
                    "ClearingArea",
                    "PaymentItemDate",
                    "PaymentItemGuid",
                    "ObjectCategory",
                    "po_type",
                    "po_typet_s",
                    "tech_stat",
                    "Status",
                    "PaymentItemNumber",
                    "Reference",
                    "ReasonDetail",
                    "Amount",
                    "CURRENCY",
                    "Aged",
                    "CounterParty"
                ].join(",") ;

            console.log(
                "EXCEPTIONDetail URL:",
                sUrl
            );

            fetch(sUrl, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            })
                .then(function (oResponse) {

                    if (!oResponse.ok) {
                        throw new Error(
                            "HTTP " +
                            oResponse.status +
                            " - " +
                            oResponse.statusText
                        );
                    }

                    return oResponse.json();
                })
                .then(function (oData) {

                    var aRows =
                        oData.value || [];

                    console.log(
                        "EXCEPTIONDetail raw rows:",
                        aRows.length
                    );

                    console.log(
                        "EXCEPTIONDetail raw data:",
                        aRows
                    );

                    /*
                     * ---------------------------------------------------------
                     * Remove duplicate records.
                     *
                     * The backend is returning the same OData key more than
                     * once. Use the actual entity key:
                     *
                     * ClearingArea + PaymentItemDate + PaymentItemGuid
                     * ---------------------------------------------------------
                     */

                    var mUniqueRows = {};

                    aRows.forEach(function (oRow) {

                        var sRowDate;

                        if (
                            oRow.PaymentItemDate instanceof Date
                        ) {

                            sRowDate =
                                oRow.PaymentItemDate.getFullYear() +
                                "-" +
                                String(
                                    oRow.PaymentItemDate.getMonth() + 1
                                ).padStart(2, "0") +
                                "-" +
                                String(
                                    oRow.PaymentItemDate.getDate()
                                ).padStart(2, "0");

                        } else {

                            sRowDate =
                                String(
                                    oRow.PaymentItemDate || ""
                                ).slice(0, 10);
                        }

                        var sKey =
                            String(
                                oRow.ClearingArea || ""
                            ) +
                            "|" +
                            sRowDate +
                            "|" +
                            String(
                                oRow.PaymentItemGuid || ""
                            );

                        /*
                         * Keep the first occurrence.
                         */
                        if (!mUniqueRows[sKey]) {
                            mUniqueRows[sKey] = oRow;
                        }

                    });

                    var aUniqueRows =
                        Object.keys(mUniqueRows).map(function (sKey) {
                            return mUniqueRows[sKey];
                        });

                    console.log(
                        "EXCEPTIONDetail unique rows:",
                        aUniqueRows.length
                    );

                    console.log(
                        "Duplicates removed:",
                        aRows.length - aUniqueRows.length
                    );

                    /*
                     * Put data into the JSON model.
                     */
                    oOpenExceptionModel.setProperty(
                        "/data",
                        aUniqueRows
                    );

                    /*
                     * Calculate Open count and maximum aging
                     * from the actual loaded rows.
                     */
                    this._calculateOpenExceptionStats(aUniqueRows);

                    this._populateFilterDropdowns();

                    oOpenExceptionModel.refresh(true);

                    console.log(
                        "Open Exception stats:",
                        {
                            total: oOpenExceptionModel.getProperty("/total"),
                            maxAge: oOpenExceptionModel.getProperty("/maxAge")
                        }
                    );

                    console.log(
                        "Open Exception table populated:",
                        aUniqueRows.length
                    );

                }.bind(this))
                .catch(function (oError) {

                    console.error(
                        "EXCEPTIONDetail fetch failed:",
                        oError
                    );

                    oOpenExceptionModel.setProperty(
                        "/data",
                        []
                    );

                    oOpenExceptionModel.refresh(true);

                }.bind(this));
        },
        // ✅ Public — called on initial load and again whenever the header's
        // Clearing Area / Date filter changes (View1.controller.js calls this
        // through _refreshExceptionKpis()). Reads the RailKpi OData entity
        // set and finds the row matching the current ClearingArea +
        // PaymentItemDate, pushing OnHold/InPostProcessing/Rejected into the
        // "By Rail" pie chart. Falls back to today's date / DEBNKC if the
        // shared filterModel isn't available yet.
        //
        // NOTE: matching is done CLIENT-SIDE (fetch all rows, find the one
        // that matches) rather than via server-side $filter. This service
        // has already shown casing mismatches between a field's $select name
        // and its filterable name (see loadExceptionKpis' "clearingarea" /
        // "paymentorderdate" lowercase filters vs. the PascalCase JSON
        // fields) — filtering client-side against the exact field names from
        // the real payload sidesteps that risk entirely.
        loadRailKpi: function () {

            console.log("Rail KPI: loadRailKpi() called");

            var oODataModel = this.getOwnerComponent().getModel("odataModel");

            var oFilterModel = this.getView().getModel("filterModel");

            var sClearingArea = oFilterModel
                ? oFilterModel.getProperty("/clearingArea")
                : "DEBNKC";

            var sSelectedDate = oFilterModel
                ? oFilterModel.getProperty("/kpiDate")
                : new Date().toISOString().slice(0, 10);

            // Normalize to a plain YYYY-MM-DD string regardless of whether
            // kpiDate is a JS Date object or already a string (same defensive
            // handling as loadExceptionTrend).
            var sDate;
            if (sSelectedDate instanceof Date) {
                sDate = sSelectedDate.getFullYear() + "-" +
                    String(sSelectedDate.getMonth() + 1).padStart(2, "0") + "-" +
                    String(sSelectedDate.getDate()).padStart(2, "0");
            } else {
                sDate = String(sSelectedDate).slice(0, 10);
            }

            var oRailModel = this.getView().getModel("railModel");

            console.log("Rail KPI: resolved filter as", { sClearingArea: sClearingArea, sDate: sDate, hasODataModel: !!oODataModel, hasRailModel: !!oRailModel });

            if (!oODataModel || !oRailModel || !sClearingArea || !sDate) {
                console.warn("Rail KPI: missing model/filter — skipping load", {
                    hasODataModel: !!oODataModel,
                    hasRailModel: !!oRailModel,
                    sClearingArea: sClearingArea,
                    sDate: sDate
                });
                return;
            }

            // Sanity-check that the RailKpi entity set actually exists in
            // this service's $metadata before binding to it. If the entity
            // set name/casing is wrong (or it lives in a different service
            // than "odataModel"), this rejects with a clear message instead
            // of the tile silently staying empty.
            oODataModel.getMetaModel().requestObject("/RailKpi").then(function (oEntityType) {
                console.log("Rail KPI: /RailKpi entity set exists in metadata", oEntityType);
            }).catch(function (oError) {
                console.error("Rail KPI: /RailKpi NOT FOUND in service metadata — entity set name/casing is likely wrong, or it belongs to a different OData service than 'odataModel'.", oError);
            });

            var oListBinding;

            try {
                oListBinding = oODataModel.bindList("/RailKpi", undefined, undefined, undefined, {
                    $select: "ClearingArea,PaymentItemDate,OnHold,InPostProcessing,Rejected"
                });
            } catch (oBindError) {
                console.error("Rail KPI: bindList() threw synchronously", oBindError);
                oRailModel.setData({ data: [], total: 0, totalText: "0 Open Items" });
                return;
            }

            oListBinding.requestContexts(0, 5000).then(function (aContexts) {

                var aRows = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });

                console.log("Rail KPI: fetched", aRows.length, "RailKpi rows; looking for", sClearingArea, sDate);

                var oMatch = aRows.find(function (oRow) {

                    var sRowDate = oRow.PaymentItemDate instanceof Date
                        ? (oRow.PaymentItemDate.getFullYear() + "-" +
                            String(oRow.PaymentItemDate.getMonth() + 1).padStart(2, "0") + "-" +
                            String(oRow.PaymentItemDate.getDate()).padStart(2, "0"))
                        : String(oRow.PaymentItemDate).slice(0, 10);

                    return oRow.ClearingArea === sClearingArea && sRowDate === sDate;
                });

                if (!oMatch) {
                    console.warn("Rail KPI: no matching row for", sClearingArea, sDate,
                        "— available ClearingArea/PaymentItemDate pairs:",
                        aRows.map(function (r) { return r.ClearingArea + " / " + r.PaymentItemDate; }));
                }

                var iHold = oMatch ? (oMatch.OnHold || 0) : 0;
                var iPostProcessing = oMatch ? (oMatch.InPostProcessing || 0) : 0;
                var iRejected = oMatch ? (oMatch.Rejected || 0) : 0;

                var iTotal = iHold + iPostProcessing + iRejected;

                // "percent" is only used by the Progress Bar view — each
                // status's share of the total, capped at 100 (ProgressIndicator
                // can't exceed 100%). Guard against divide-by-zero when total is 0.
                function toPercent(iValue) {
                    return iTotal > 0 ? Math.min(Math.round((iValue / iTotal) * 100), 100) : 0;
                }

                oRailModel.setData({
                    data: [
                        { status: "On Hold", value: iHold, percent: toPercent(iHold) },
                        { status: "In Post-Processing", value: iPostProcessing, percent: toPercent(iPostProcessing) },
                        { status: "Rejected", value: iRejected, percent: toPercent(iRejected) }
                    ],
                    total: iTotal,
                    totalText: iTotal + " Open Items · " + sClearingArea
                });

            }).catch(function (oError) {
                console.error("Rail KPI load failed:", oError);
                oRailModel.setData({ data: [], total: 0, totalText: "0 Open Items" });
            });
        },

        loadExceptionTrend: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this.getView().getModel("filterModel");
            var oTrendModel = this.getView().getModel("trendModel");

            if (!oODataModel || !oTrendModel) {
                console.error("Trend: OData model or trendModel missing");
                return;
            }

            var sClearingArea = oFilterModel
                ? oFilterModel.getProperty("/clearingArea")
                : "DEBNKC";

            var sSelectedDate = oFilterModel
                ? oFilterModel.getProperty("/kpiDate")
                : null;

            if (!sSelectedDate) {
                console.warn("Trend: selected date is empty");
                return;
            }

            /*
             * ============================================================
             * IMPORTANT:
             * PaymentOrderDate is a BUSINESS DATE.
             *
             * Do NOT use toISOString() for date conversion because
             * it converts local midnight to UTC and can shift the date
             * one day backwards in IST.
             * ============================================================
             */

            var oEndDate;

            /*
             * If kpiDate is a JavaScript Date object
             */
            if (sSelectedDate instanceof Date) {

                oEndDate = new Date(
                    sSelectedDate.getFullYear(),
                    sSelectedDate.getMonth(),
                    sSelectedDate.getDate()
                );

            } else {

                /*
                 * If kpiDate is already a string such as:
                 * 2026-03-02
                 */
                var aDateParts = String(sSelectedDate)
                    .slice(0, 10)
                    .split("-");

                oEndDate = new Date(
                    Number(aDateParts[0]),
                    Number(aDateParts[1]) - 1,
                    Number(aDateParts[2])
                );
            }

            /*
             * ============================================================
             * Helper to format a Date as YYYY-MM-DD
             * WITHOUT using toISOString()
             * ============================================================
             */

            function formatBusinessDate(oDate) {

                return (
                    oDate.getFullYear() +
                    "-" +
                    String(oDate.getMonth() + 1).padStart(2, "0") +
                    "-" +
                    String(oDate.getDate()).padStart(2, "0")
                );
            }

            /*
             * ============================================================
             * Helper to format a Date as "Jun 11" for the chart axis label
             * ============================================================
             */

            var aTrendMonthShortNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            function formatTrendAxisLabel(oDate) {

                return (
                    aTrendMonthShortNames[oDate.getMonth()] +
                    " " +
                    oDate.getDate()
                );
            }

            /*
             * ============================================================
             * Last 7 days INCLUDING selected date
             *
             * Example:
             * Selected date = 2026-03-02
             *
             * Start = 2026-02-24
             * End   = 2026-03-02
             * ============================================================
             */

            var oStartDate = new Date(oEndDate);

            oStartDate.setDate(
                oStartDate.getDate() - 6
            );

            var sStartDate = formatBusinessDate(oStartDate);
            var sEndDate = formatBusinessDate(oEndDate);

            console.log(
                "Exception Trend:",
                "ClearingArea =", sClearingArea,
                "Selected Date =", sSelectedDate,
                "Start =", sStartDate,
                "End =", sEndDate
            );

            /*
             * ============================================================
             * OData filters
             * ============================================================
             */

            var aFilters = [

                new Filter(
                    "ClearingArea",
                    FilterOperator.EQ,
                    sClearingArea
                ),

                new Filter(
                    "PaymentOrderDate",
                    FilterOperator.GE,
                    sStartDate
                ),

                new Filter(
                    "PaymentOrderDate",
                    FilterOperator.LE,
                    sEndDate
                )

            ];

            /*
             * ============================================================
             * Read DailyExceptionTrend
             * ============================================================
             */

            var oListBinding = oODataModel.bindList(
                "/DailyExceptionTrend",
                undefined,
                undefined,
                aFilters,
                {
                    $select:
                        "ClearingArea,PaymentOrderDate,Opened,Resolved"
                }
            );

            oListBinding.requestContexts(0, 5000)

                .then(function (aContexts) {

                    console.log(
                        "Exception Trend OData rows:",
                        aContexts.length
                    );

                    /*
                     * Convert OData contexts into normal objects
                     */

                    var aODataRows = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });

                    console.log(
                        "Exception Trend OData data:",
                        aODataRows
                    );

                    /*
                     * ====================================================
                     * Map OData data by BUSINESS DATE
                     * ====================================================
                     */

                    var mByDate = {};

                    aODataRows.forEach(function (oRow) {

                        var sDate = oRow.PaymentOrderDate;

                        /*
                         * If OData returns a Date object,
                         * extract the LOCAL business date.
                         */
                        if (sDate instanceof Date) {

                            sDate =
                                sDate.getFullYear() +
                                "-" +
                                String(sDate.getMonth() + 1).padStart(2, "0") +
                                "-" +
                                String(sDate.getDate()).padStart(2, "0");

                        } else {

                            /*
                             * If OData already returns YYYY-MM-DD,
                             * keep only the date portion.
                             */
                            sDate = String(sDate).slice(0, 10);
                        }

                        mByDate[sDate] = {

                            opened:
                                Number(oRow.Opened) || 0,

                            resolved:
                                Number(oRow.Resolved) || 0

                        };

                        console.log(
                            "Mapped OData date:",
                            sDate,
                            "Opened:",
                            mByDate[sDate].opened,
                            "Resolved:",
                            mByDate[sDate].resolved
                        );
                    });

                    /*
                     * ====================================================
                     * Create exactly 7 dates
                     * ====================================================
                     */

                    var aTrendData = [];

                    for (var i = 0; i < 7; i++) {

                        var oDate = new Date(oStartDate);

                        oDate.setDate(
                            oStartDate.getDate() + i
                        );

                        /*
                         * IMPORTANT:
                         * Do NOT use toISOString() here.
                         */

                        var sISODate =
                            formatBusinessDate(oDate);

                        /*
                         * Get OData values for this exact date.
                         * If no OData row exists, show 0.
                         */

                        var oValues =
                            mByDate[sISODate] || {
                                opened: 0,
                                resolved: 0
                            };

                        aTrendData.push({

                            date: sISODate,

                            dateLabel:
                                formatTrendAxisLabel(oDate),

                            opened:
                                oValues.opened,

                            resolved:
                                oValues.resolved

                        });
                    }

                    console.log(
                        "Exception Trend chart data:",
                        aTrendData
                    );



                    /*

                    
                     * ====================================================
                     * Update existing trendModel
                     * ====================================================
                     */

                    // Dynamic backlog warning
                    var oWarning =
                        this._getTrendWarningMessage(aTrendData);

                    // Set trend data
                    oTrendModel.setProperty(
                        "/data",
                        aTrendData
                    );

                    // Set dynamic warning message
                    oTrendModel.setProperty(
                        "/warning",
                        oWarning
                    );

                    oTrendModel.refresh(true);

                    /*
                     * ====================================================
                     * Rebuild chart after data arrives
                     * ====================================================
                     */

                    var oChart =
                        this.byId("_IDGenVizFrame");

                    if (oChart) {

                        var sChartType =
                            this._sActiveTrendConfigKey
                                ? TREND_CHART_TYPE_CONFIG[
                                    this._sActiveTrendConfigKey
                                ].vizType
                                : "bar";

                        this._applyTrendAxisChartType(
                            sChartType
                        );
                    }

                }.bind(this))

                .catch(function (oError) {

                    console.error(
                        "Exception Trend OData load failed:",
                        oError
                    );

                });

        },

        // ✅ "Exception Reasons" card — was 5 hardcoded rows (Sanctions Hold,
        // AML Review, IBAN Validation, Duplicate Payment, Reconciliation);
        // now driven by the ExceptionsByReason OData entity set, filtered to
        // the same ClearingArea + PaymentOrderDate as the KPI tiles above.
        // Rows with the same CheckTextShort are grouped (summing Exceptions),
        // sorted descending, and only the top 5 are kept — same shape the
        // view already expects, just data-driven now. Called on init and
        // again whenever the header filter changes (same trigger points as
        // loadExceptionKpis, wired in View1.controller.js's
        // _refreshExceptionKpis).
        loadExceptionReasons: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this.getView().getModel("filterModel");

            var sClearingArea = oFilterModel
                ? oFilterModel.getProperty("/clearingArea")
                : "DEBNKC";

            var sDate = oFilterModel
                ? oFilterModel.getProperty("/kpiDate")
                : new Date().toISOString().slice(0, 10);

            var oReasonModel = this.getView().getModel("reasonModel");

            if (!oODataModel || !sClearingArea || !sDate || !oReasonModel) {
                return;
            }

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("PaymentOrderDate", FilterOperator.EQ, sDate)
            ];

            var oListBinding = oODataModel.bindList("/ExceptionsByReason", undefined, undefined, aFilters, {
                $select: "ClearingArea,PaymentOrderDate,CheckTextShort,Exceptions"
            });

            // Grouping/top-5 happens client-side below, so pull every matching
            // row for the day rather than paging a handful at a time.
            oListBinding.requestContexts(0, 5000).then(function (aContexts) {
                var mGrouped = {};
                var iCriticalTotal = 0;

                aContexts.forEach(function (oContext) {

                    var oRow = oContext.getObject();

                    var sReason =
                        (oRow.CheckTextShort || "").trim();

                    if (!sReason) {
                        return;
                    }

                    var iExceptions =
                        Number(oRow.Exceptions) || 0;

                    // Sum all exception counts for the selected day
                    iCriticalTotal += iExceptions;

                    // Group by reason
                    mGrouped[sReason] =
                        (mGrouped[sReason] || 0) +
                        iExceptions;
                });

                var aGrouped = Object.keys(mGrouped).map(function (sReason) {
                    return { reason: sReason, value: mGrouped[sReason] };
                });

                aGrouped.sort(function (a, b) {
                    return b.value - a.value;
                });

                var aTop5 = aGrouped.slice(0, 5);

                // Same rank-based colour grading the original static rows
                // used (green/blue/orange/red/red), now via ProgressIndicator's
                // built-in semantic "state" instead of a custom CSS class.
                var aStates = ["Positive", "Information", "Critical", "Negative", "Negative"];

                var aTopReasons = aTop5.map(function (oRow, iIndex) {
                    return {
                        reason: oRow.reason,
                        value: oRow.value,
                        displayValue: oRow.value >= 1000
                            ? (oRow.value / 1000).toFixed(1) + "K"
                            : String(oRow.value),
                        // "17 percent filled in 100" — the exception count
                        // itself is the fill percentage, capped at 100 so a
                        // count above 100 doesn't overflow the bar.
                        percent: Math.min(oRow.value, 100),
                        state: aStates[iIndex] || "Negative"
                    };
                });

                oReasonModel.setProperty("/topReasons", aTopReasons);

                oReasonModel.setProperty(
                    "/criticalTotal",
                    iCriticalTotal
                );

            }).catch(function (oError) {
                console.error("Exception Reasons load failed:", oError);
                oReasonModel.setProperty("/topReasons", []);
            });
        },






        // ✅ FIX: this formatter was referenced in the view (teamWorkloadModel>status icon)
        // but was never defined in the original View1.controller.js, so the icon
        // silently never rendered. Added here to match formatWorkloadStatus's logic.
        formatWorkloadIcon: function (sStatus) {
            if (sStatus === "On Case") {
                return "sap-icon://busy";
            }
            if (sStatus === "Available") {
                return "sap-icon://employee";
            }
            return "sap-icon://status-in-process";
        },

        // ✅ Chart-type switcher for the Exception Trend chart — same pattern as
        // onChartTypeMenuPress in View1.controller.js. Builds the menu once from
        // TREND_CHART_TYPE_CONFIG and reuses it on every press.
        onTrendChartTypeMenuPress: function (oEvent) {
            var oButton = oEvent.getSource();

            if (!this._oTrendChartTypeMenu) {

                var aItems = Object.keys(TREND_CHART_TYPE_CONFIG).map(function (sConfigKey) {
                    var oConfig = TREND_CHART_TYPE_CONFIG[sConfigKey];
                    var oItem = new sap.m.MenuItem({ text: oConfig.label, icon: oConfig.icon });
                    oItem.data("configKey", sConfigKey);
                    return oItem;
                });

                this._oTrendChartTypeMenu = new sap.m.Menu({
                    items: aItems,
                    itemSelected: this.onTrendChartTypeSelected.bind(this)
                });
                this.getView().addDependent(this._oTrendChartTypeMenu);
            }

            this._oTrendChartTypeMenu.openBy(oButton);
        },

        onTrendChartTypeSelected: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sConfigKey = oItem.data("configKey");
            if (!sConfigKey) {
                return;
            }
            this._applyTrendChartType(sConfigKey);
        },

        // ✅ "By Rail" chart-type switcher — Pie Chart vs. Progress Bar.
        // Same menu-button pattern as onTrendChartTypeMenuPress, built once
        // from RAIL_CHART_TYPE_CONFIG and reused on every press.
        onRailChartTypeMenuPress: function (oEvent) {
            var oButton = oEvent.getSource();

            if (!this._oRailChartTypeMenu) {

                var aItems = Object.keys(RAIL_CHART_TYPE_CONFIG).map(function (sConfigKey) {
                    var oConfig = RAIL_CHART_TYPE_CONFIG[sConfigKey];
                    var oItem = new sap.m.MenuItem({ text: oConfig.label, icon: oConfig.icon });
                    oItem.data("configKey", sConfigKey);
                    return oItem;
                });

                this._oRailChartTypeMenu = new sap.m.Menu({
                    items: aItems,
                    itemSelected: this.onRailChartTypeSelected.bind(this)
                });
                this.getView().addDependent(this._oRailChartTypeMenu);
            }

            this._oRailChartTypeMenu.openBy(oButton);
        },

        // Unlike the Trend chart, both views read the same railModel>/data
        // shape (status/value/percent) — so switching is just flipping
        // railViewModel>/chartType, which the view's visible= expressions
        // react to directly. No dataset/feed rebuild needed.
        onRailChartTypeSelected: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sConfigKey = oItem.data("configKey");
            var oConfig = RAIL_CHART_TYPE_CONFIG[sConfigKey];

            if (!oConfig) {
                return;
            }

            this.getView().getModel("railViewModel").setProperty("/chartType", oConfig.chartType);

            var oButton = this.byId("railChartTypeButton");
            if (oButton) {
                oButton.setIcon(oConfig.icon);
                oButton.setTooltip(oConfig.label);
            }
        },

        // ✅ Central dispatcher for the Trend chart — same role as
        // _applyChartType in View1.controller.js. Sets the button's icon to
        // match, then rebuilds the dataset/feeds for whichever mode the
        // selected type needs.
        _applyTrendChartType: function (sConfigKey) {
            var oConfig = TREND_CHART_TYPE_CONFIG[sConfigKey];
            var oTrendChart = this.byId("_IDGenVizFrame");
            if (!oConfig || !oTrendChart) {
                return;
            }

            this._sActiveTrendConfigKey = sConfigKey;

            var oButton = this.byId("trendChartTypeButton");
            if (oButton) {
                oButton.setIcon(oConfig.icon);
                oButton.setTooltip(oConfig.label);
            }

            switch (oConfig.mode) {
                case "heatmap":
                    this._applyTrendHeatmapChartType();
                    break;
                case "share":
                    this._applyTrendShareChartType(oConfig.vizType);
                    break;
                default:
                    this._applyTrendAxisChartType(oConfig.vizType);
            }
        },

        // ── Trend data-reshaping helpers ──────────────────────────────────
        _getTrendOpenedResolvedTotals: function () {
            var aData = this.getView().getModel("trendModel").getProperty("/data") || [];
            var iOpened = 0;
            var iResolved = 0;
            aData.forEach(function (o) {
                iOpened += o.opened || 0;
                iResolved += o.resolved || 0;
            });
            return [
                { Category: "Opened", Total: iOpened },
                { Category: "Resolved", Total: iResolved }
            ];
        },

        _getTrendHeatmapData: function () {

            var aData =
                this.getView()
                    .getModel("trendModel")
                    .getProperty("/data") || [];

            var aOut = [];

            aData.forEach(function (o) {

                aOut.push({
                    Day: o.dateLabel,
                    Type: "Opened",
                    Value: Number(o.opened) || 0
                });

                aOut.push({
                    Day: o.dateLabel,
                    Type: "Resolved",
                    Value: Number(o.resolved) || 0
                });

            });

            return aOut;
        },

        // ── Trend mode implementations ────────────────────────────────────

        // Bar/Column/Line/Stacked/100% Stacked — Day dimension, Opened+Resolved
        // measures, same shape the chart already ships with.
        _applyTrendAxisChartType: function (sVizType) {

            var oTrendChart = this.byId("_IDGenVizFrame");
            var oTrendModel = this.getView().getModel("trendModel");

            if (!oTrendChart || !oTrendModel) {
                return;
            }

            var aData = oTrendModel.getProperty("/data") || [];

            console.log(
                "Rendering Exception Trend:",
                sVizType,
                aData
            );

            oTrendChart.removeAllFeeds();

            var oDataset = new FlattenedDataset({

                dimensions: [
                    {
                        name: "Date",
                        value: "{trendModel>dateLabel}"
                    }
                ],

                measures: [
                    {
                        name: "Opened",
                        value: "{trendModel>opened}"
                    },
                    {
                        name: "Resolved",
                        value: "{trendModel>resolved}"
                    }
                ],

                data: {
                    path: "trendModel>/data"
                }
            });

            oTrendChart.setDataset(oDataset);

            oTrendChart.addFeed(
                new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: [
                        "Opened",
                        "Resolved"
                    ]
                })
            );

            oTrendChart.addFeed(
                new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: [
                        "Date"
                    ]
                })
            );

            oTrendChart.setVizType(
                sVizType || "bar"
            );

            oTrendChart.setVizProperties({
                title: { visible: false },
                legend: { visible: true, position: "bottom", alignment: "center" },
                plotArea: {
                    colorPalette: ["#c17b74", "#7a9e6f"]
                },
                categoryAxis: { title: { visible: false }, label: { visible: true } },
                valueAxis: { title: { visible: false }, label: { visible: true } }
            });

            /*
             * Explicitly refresh the chart
             */
            oTrendChart.invalidate();

            console.log(
                "Exception Trend chart rendered with",
                aData.length,
                "rows"
            );
        },
        // Pie/Donut — part-to-whole, not a time series: total Opened vs total
        // Resolved across the whole trend window.
        _applyTrendShareChartType: function (sVizType) {
            var oTrendChart = this.byId("_IDGenVizFrame");
            var aTotals = this._getTrendOpenedResolvedTotals();

            this.getView().getModel("trendModel").setProperty("/openedResolvedShare", aTotals);

            oTrendChart.removeAllFeeds();
            oTrendChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Category", value: "{trendModel>Category}" }
                ],
                measures: [
                    { name: "Total", value: "{trendModel>Total}" }
                ],
                data: { path: "trendModel>/openedResolvedShare" }
            }));
            oTrendChart.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["Total"] }));
            oTrendChart.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Category"] }));

            oTrendChart.setVizType(sVizType);
            oTrendChart.setVizProperties({ plotArea: { colorPalette: ["#c17b74", "#7a9e6f"] } });
        },

        // Heat Map — Day × Type (Opened/Resolved) grid, colored by count.
        _applyTrendHeatmapChartType: function () {
            var oTrendChart = this.byId("_IDGenVizFrame");
            var aHeatmapData = this._getTrendHeatmapData();

            this.getView().getModel("trendModel").setProperty("/heatmapData", aHeatmapData);

            oTrendChart.removeAllFeeds();
            oTrendChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{trendModel>Day}" },
                    { name: "Type", value: "{trendModel>Type}" }
                ],
                measures: [
                    { name: "Value", value: "{trendModel>Value}" }
                ],
                data: { path: "trendModel>/heatmapData" }
            }));
            oTrendChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oTrendChart.addFeed(new FeedItem({ uid: "categoryAxis2", type: "Dimension", values: ["Type"] }));
            oTrendChart.addFeed(new FeedItem({ uid: "color", type: "Measure", values: ["Value"] }));

            oTrendChart.setVizType("heatmap");
        },

        // ✅ Maximize / Restore for the Exception Trend chart — same
        // remove-from-parent / move-into-Dialog / restore-on-close pattern as
        // onToggleChartSize in View1.controller.js.
        onToggleTrendChartSize: function () {

            var oCard = this.byId("_IDGenVBox37");
            var oButton = this.byId("trendExpandButton");

            var iContentWidth = this._getContentAreaWidth();

            if (!this._oTrendDialog) {

                this._oTrendDialog = new sap.m.Dialog({
                    contentWidth: iContentWidth + "px",
                    contentHeight: "85vh",
                    stretch: false,
                    draggable: true,
                    resizable: true,
                    horizontalScrolling: false,
                    verticalScrolling: true,
                    class: "dashboardExpandDialog"
                });

                this.getView().addDependent(this._oTrendDialog);

                this._oTrendDialog.attachAfterClose(function () {

                    if (this._oOriginalTrendParent) {

                        this._oOriginalTrendParent.insertItem(
                            oCard,
                            this._iOriginalTrendIndex
                        );

                        oCard.setWidth("40%");
                        oCard.setHeight("420px");

                        this.byId("_IDGenVizFrame").setHeight("260px");

                        oButton.setIcon("sap-icon://full-screen");

                        this._bTrendExpanded = false;
                    }

                }.bind(this));

            } else {
                this._oTrendDialog.setContentWidth(iContentWidth + "px");
            }

            if (!this._bTrendExpanded) {

                this._oOriginalTrendParent = oCard.getParent();

                this._iOriginalTrendIndex =
                    this._oOriginalTrendParent.indexOfItem(oCard);

                this._oOriginalTrendParent.removeItem(oCard);

                oCard.setWidth("100%");
                oCard.setHeight("100%");

                this.byId("_IDGenVizFrame").setWidth("100%");
                this.byId("_IDGenVizFrame").setHeight("650px");

                this._oTrendDialog.removeAllContent();
                this._oTrendDialog.addContent(oCard);

                oButton.setIcon("sap-icon://exit-full-screen");

                this._bTrendExpanded = true;

                this._oTrendDialog.open();

            } else {

                oCard.setWidth("40%");
                oCard.setHeight("420px");

                this.byId("_IDGenVizFrame").setHeight("260px");

                this._oTrendDialog.close();

            }

        },
        // ✅ sap.viz has no vizProperties option to style a single categoryAxis
        // label differently from the rest — "categoryAxis.label" applies to
        // every label uniformly. So instead, once the chart has actually
        // painted its SVG, find the "Today" text node and bump its
        // font-weight/font-size directly. Runs after every render — including
        // chart-type switches and resize on maximize — so it never falls out
        // of sync with whatever's currently drawn.
        onTrendChartRenderComplete: function () {
            var oTrendChart = this.byId("_IDGenVizFrame");
            if (!oTrendChart) {
                return;
            }

            // VizFrame's own SVG paint can finish a tick after renderComplete
            // fires, so defer to the next tick before touching the DOM.
            setTimeout(function () {
                oTrendChart.$().find("text").each(function () {
                    var $text = jQuery(this);
                    if ($text.text().trim() === "Today") {
                        $text.css({
                            "font-weight": "bold",
                            "font-size": "13px"
                        });
                    }
                });
            }, 0);
        },

        _getTrendWarningMessage: function (aTrendData) {

            if (!aTrendData || aTrendData.length === 0) {
                return {
                    type: "Information",
                    message:
                        "No Trend Data: No exception activity is available for the selected date."
                };
            }

            // Last item = selected date
            var oToday =
                aTrendData[aTrendData.length - 1];

            var iOpened =
                Number(oToday.opened) || 0;

            var iResolved =
                Number(oToday.resolved) || 0;

            var iDifference =
                Math.abs(iOpened - iResolved);

            /*
             * Count consecutive days where
             * Opened > Resolved.
             */
            var iGrowingDays = 0;

            for (
                var i = aTrendData.length - 1;
                i >= 0;
                i--
            ) {

                var iDayOpened =
                    Number(aTrendData[i].opened) || 0;

                var iDayResolved =
                    Number(aTrendData[i].resolved) || 0;

                if (iDayOpened > iDayResolved) {
                    iGrowingDays++;
                } else {
                    break;
                }
            }

            /*
             * Helper for 1st / 2nd / 3rd / 4th...
             */
            var getOrdinal = function (iNumber) {

                if (
                    iNumber % 100 >= 11 &&
                    iNumber % 100 <= 13
                ) {
                    return iNumber + "th";
                }

                switch (iNumber % 10) {

                    case 1:
                        return iNumber + "st";

                    case 2:
                        return iNumber + "nd";

                    case 3:
                        return iNumber + "rd";

                    default:
                        return iNumber + "th";
                }
            };

            /*
             * Backlog is growing
             */
            if (iOpened > iResolved) {

                var sMessage =
                    "Backlog Growing: Opened (" +
                    iOpened +
                    ") exceeds resolved (" +
                    iResolved +
                    ") by " +
                    iDifference;

                if (iGrowingDays > 1) {

                    sMessage +=
                        " – " +
                        getOrdinal(iGrowingDays) +
                        " consecutive day.";

                } else {

                    sMessage += ".";

                }

                return {
                    type: "Warning",
                    message: sMessage
                };
            }

            /*
             * Backlog is improving
             */
            if (iResolved > iOpened) {

                return {
                    type: "Success",
                    message:
                        "Backlog Improving: Resolved (" +
                        iResolved +
                        ") exceeds opened (" +
                        iOpened +
                        ") by " +
                        iDifference +
                        "."
                };
            }

            /*
             * Backlog is stable
             */
            return {
                type: "Information",
                message:
                    "Backlog Stable: Opened and resolved are both " +
                    iOpened +
                    "."
            };
        },

        onBulkAction: function () {

            var oTable = this.byId("_IDGenTable3");

            if (!oTable) {
                return;
            }

            var aItems = oTable.getItems();

            if (!aItems.length) {
                sap.m.MessageToast.show("No exceptions available.");
                return;
            }

            // Select all rows
            aItems.forEach(function (oItem) {
                oTable.setSelectedItem(oItem, true);
            });

            // Store selected data
            this._aSelectedExceptions = aItems.map(function (oItem) {

                return oItem
                    .getBindingContext("startupModel")
                    .getObject();

            });

            console.log(
                "Bulk selected exceptions:",
                this._aSelectedExceptions
            );


        },

        onStartupRowSelectionChange: function (oEvent) {

            var oTable = oEvent.getSource();

            var aSelectedItems =
                oTable.getSelectedItems();

            console.log(
                "Selected exception rows:",
                aSelectedItems
            );

            var aSelectedData =
                aSelectedItems.map(function (oItem) {

                    return oItem
                        .getBindingContext("startupModel")
                        .getObject();

                });

            console.log(
                "Selected exception data:",
                aSelectedData
            );

            // Store for later bulk processing
            this._aSelectedExceptions = aSelectedData;
        },

        onToggleRailChartType: function () {

            var oViewModel = this.getView().getModel("railViewModel");

            if (!oViewModel) {
                return;
            }

            var sCurrentType = oViewModel.getProperty("/chartType");

            var sNewType =
                sCurrentType === "pie"
                    ? "progress"
                    : "pie";

            oViewModel.setProperty("/chartType", sNewType);

            var oButton = this.byId("railChartTypeButton");

            if (oButton) {

                if (sNewType === "progress") {

                    oButton.setIcon(
                        "sap-icon://pie-chart"
                    );

                    oButton.setTooltip(
                        "Show Pie Chart"
                    );

                } else {

                    oButton.setIcon(
                        "sap-icon://horizontal-bar-chart-2"
                    );

                    oButton.setTooltip(
                        "Show Progress Bar"
                    );
                }
            }
        },

        onOpenExceptionsPress: function () {

            console.log("Open Exceptions KPI clicked");

            var oModel = this.getView()
                .getModel("openExceptionModel");

            if (!oModel) {
                console.error(
                    "openExceptionModel not found"
                );
                return;
            }

            // Clear old data first
            oModel.setProperty("/data", []);

            this.loadOpenExceptionDetails();
        },
        _updateOpenExceptionCount: function (oBinding) {

            if (!oBinding) {
                return;
            }

            var aContexts = oBinding.getCurrentContexts
                ? oBinding.getCurrentContexts()
                : [];

            var aRows = aContexts.map(function (oContext) {
                return oContext.getObject();
            });

            var iTotal = aRows.length;

            var sMaxAge = "";

            var ageToMinutes = function (sAge) {

                if (!sAge) {
                    return 0;
                }

                sAge = String(sAge).trim();

                var iMinutes = 0;

                var oHourMatch =
                    sAge.match(/(\d+)\s*h/i);

                var oMinuteMatch =
                    sAge.match(/(\d+)\s*m/i);

                if (oHourMatch) {
                    iMinutes +=
                        parseInt(oHourMatch[1], 10) * 60;
                }

                if (oMinuteMatch) {
                    iMinutes +=
                        parseInt(oMinuteMatch[1], 10);
                }

                return iMinutes;
            };

            var iMaxMinutes = -1;

            aRows.forEach(function (oRow) {

                var sAge = oRow.Aged;

                var iMinutes =
                    ageToMinutes(sAge);

                if (iMinutes > iMaxMinutes) {

                    iMaxMinutes = iMinutes;

                    sMaxAge = sAge;
                }
            });

            var oModel =
                this.getView()
                    .getModel("openExceptionModel");

            if (!oModel) {
                return;
            }

            oModel.setProperty(
                "/total",
                iTotal
            );

            oModel.setProperty(
                "/maxAge",
                sMaxAge
            );

            console.log(
                "Filtered Open Exceptions:",
                iTotal,
                "Max Age:",
                sMaxAge
            );
        },

        _calculateOpenExceptionStats: function (aRows) {

            var iTotal = aRows.length;
            var sMaxAge = "";
            var iMaxAmount = 0;

            var ageToMinutes = function (sAge) {

                if (!sAge) {
                    return 0;
                }

                sAge = String(sAge).trim();

                var iMinutes = 0;

                var oHourMatch =
                    sAge.match(/(\d+)\s*h/i);

                var oMinuteMatch =
                    sAge.match(/(\d+)\s*m/i);

                if (oHourMatch) {
                    iMinutes +=
                        parseInt(oHourMatch[1], 10) * 60;
                }

                if (oMinuteMatch) {
                    iMinutes +=
                        parseInt(oMinuteMatch[1], 10);
                }

                return iMinutes;
            };

            var amountToNumber = function (sAmount) {

                if (sAmount === null ||
                    sAmount === undefined) {
                    return 0;
                }

                var sValue = String(sAmount)
                    .replace(/SAR/gi, "")
                    .replace(/,/g, "")
                    .trim();

                return parseFloat(sValue) || 0;
            };


            var iMaxMinutes = -1;

            aRows.forEach(function (oRow) {

                // =========================
                // MAX AGE
                // =========================
                var sAge = oRow.Aged;

                var iMinutes =
                    ageToMinutes(sAge);

                if (iMinutes > iMaxMinutes) {

                    iMaxMinutes = iMinutes;

                    sMaxAge = sAge;
                }


                // =========================
                // MAX AMOUNT
                // =========================
                var iAmount =
                    amountToNumber(oRow.Amount);

                if (iAmount > iMaxAmount) {

                    iMaxAmount = iAmount;
                }

            });


            var oModel =
                this.getView()
                    .getModel("openExceptionModel");


            oModel.setProperty(
                "/total",
                iTotal
            );

            oModel.setProperty(
                "/maxAge",
                sMaxAge
            );

            oModel.setProperty(
                "/maxAmount",
                iMaxAmount.toLocaleString()
            );

            oModel.refresh(true);

            console.log(
                "Open Exception Stats:",
                {
                    total: iTotal,
                    maxAge: sMaxAge,
                    maxAmount: iMaxAmount
                }
            );
        },

        _attachKpiCardClicks: function () {

            var oCard = this.byId("_IDGenKpiOpenExceptions");
            if (!oCard) { return; }

            if (oCard.data("clickBound")) { return; }

            oCard.attachBrowserEvent("click", this.onOpenExceptionsPress, this);
            oCard.data("clickBound", true);

        },

        // ✅ Formats ValueAtRisk as €86.0M / €142.5K / €420 depending on magnitude.
        // Same K/M abbreviation pattern as _updateStatusBreakdown's fmt() in
        // View1.controller.js, with a € prefix per the reference design.
        formatValueAtRisk: function (vValue) {

            var fValue = Number(vValue) || 0;

            if (fValue >= 1000000) {
                return "€" + (fValue / 1000000).toFixed(1) + "M";
            }

            if (fValue >= 1000) {
                return "€" + (fValue / 1000).toFixed(1) + "K";
            }

            return "€" + fValue.toLocaleString();

        },


        // ✅ Open Exceptions: MORE exceptions is bad, so "up" = warn color, "down" = good color.
        // Returns "" (nothing shown) when there's no real yesterday value to compare against.
        formatOpenExceptionTrendText: function (oTrend) {

            if (!oTrend || !oTrend.hasData) {
                return "";
            }

            if (oTrend.direction === "flat") {
                return "No change vs yesterday";
            }

            var sArrow = oTrend.direction === "up" ? "+" : "-";

            return sArrow + oTrend.percent.toFixed(1) + "% vs yesterday";

        },

        formatOpenExceptionTrendClass: function (oTrend) {

            if (!oTrend || !oTrend.hasData || oTrend.direction === "flat") {
                return "kpiCardSubtext";
            }

            // Rising open exceptions = bad (warn), falling = good.
            return oTrend.direction === "up"
                ? "kpiCardSubtext kpiCardSubtextWarn"
                : "kpiCardSubtext kpiCardSubtextGood";

        },

        // ✅ Value at Risk: same "more is worse" semantics as Open Exceptions.
        // ✅ Value at Risk: same "more is worse" semantics as Open Exceptions.
        formatValueAtRiskTrendText: function (oTrend) {

            if (!oTrend || !oTrend.hasData) {
                return "";
            }

            if (oTrend.direction === "flat") {
                return "No change vs yesterday";
            }

            var sArrow = oTrend.direction === "up" ? "+" : "-";

            return sArrow + oTrend.percent.toFixed(1) + "% vs yesterday";

        },

        formatValueAtRiskTrendClass: function (oTrend) {

            if (!oTrend || !oTrend.hasData || oTrend.direction === "flat") {
                return "kpiCardSubtext";
            }

            return oTrend.direction === "up"
                ? "kpiCardSubtext kpiCardSubtextWarn"
                : "kpiCardSubtext kpiCardSubtextGood";

        },

        _getContentAreaWidth: function () {
            var oViewDom = this.getView().getDomRef();
            if (oViewDom) {
                return oViewDom.offsetWidth;
            }
            return window.innerWidth * 0.92;
        }


    });
});