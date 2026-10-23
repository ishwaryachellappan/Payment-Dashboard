sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, FlattenedDataset, FeedItem, Spreadsheet, MessageToast) {
    "use strict";

    var SERVICE_URL = "/sap/opu/odata4/sap/zpe_sb_po_data/srvd/sap/zpe_sd_po_data/0001/";

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

    // "By Rail": pie vs. progress bar. Both read railModel>/data.
    var RAIL_CHART_TYPE_CONFIG = {
        pie: { chartType: "pie", label: "Pie Chart", icon: "sap-icon://pie-chart" },
        progress: { chartType: "progress", label: "Progress Bar", icon: "sap-icon://horizontal-bar-chart-2" }
    };

    return Controller.extend("payment.dashboard.controller.Exception", {

        onInit: function () {

            var oView = this.getView();

            oView.setModel(new JSONModel({
                OpenException: 0,
                ValueAtRisk: 0,
                openExceptionTrend: { percent: 0, direction: "flat", hasData: false },
                valueAtRiskTrend: { percent: 0, direction: "flat", hasData: false }
            }), "exceptionKpiModel");

            oView.setModel(new JSONModel({ topReasons: [], criticalTotal: 0 }), "reasonModel");
            oView.setModel(new JSONModel({ data: [] }), "trendModel");

            oView.setModel(new JSONModel({
                total: 0,
                totalText: "",
                data: [],
                selectedStatus: "",
                selectedCount: 0
            }), "railModel");

            oView.setModel(new JSONModel({ chartType: "pie" }), "railViewModel");

            var oApprovalModel = new JSONModel({
                data: [
                    { ref: "SARIE-260522-008142", rail: "SARIE", customer: "Ministry of Finance", amount: "SAR 86,000,000", age: "3h 02m", status: "Open", reason: "Mid-month disbursement > SAR 50M" },
                    { ref: "SARIE-260522-008231", rail: "SARIE", customer: "Ministry of Education", amount: "SAR 24,000,000", age: "1h 44m", status: "Open", reason: "Country Risk - False Positive" },
                    { ref: "WPS-260522-MOI-031", rail: "WPS", customer: "Ministry of Interior", amount: "SAR 8,280,000", age: "12m", status: "Rejected", reason: "Name Match - UN Consolidated List" }
                ]
            });

            var oPostProcessingModel = new JSONModel({
                data: [
                    { ref: "SARIE-260522-008402", rail: "SARIE", customer: "GOSI", amount: "SAR 18,400,000", age: "58m", status: "Rejected", reason: "Settlement ACK Pending - Queued" },
                    { ref: "SARIE-260522-008411", rail: "SARIE", customer: "Saudi Customs", amount: "SAR 4,800,000", age: "42m", status: "Rejected", reason: "Settlement ACK Pending - Queued" },
                    { ref: "SARIE-260522-008455", rail: "SARIE", customer: "ZATCA refund - TXN-99214", amount: "SAR 412,000", age: "8m", status: "Rejected", reason: "Settlement ACK Pending - Queued" }
                ]
            });

            var oRejectedModel = new JSONModel({
                data: [
                    { ref: "MT103-260522-014008", rail: "SWIFT", customer: "Saudi Binladin Group", amount: "SAR 1,026,400", age: "6h 44m", status: "Rejected", reason: "Invalid intermediary BIC - NAK" },
                    { ref: "WPS-260522-AMR-027", rail: "WPS", customer: "Almarai - 1 Employee", amount: "SAR 18,400", age: "4h 12m", status: "Rejected", reason: "IBAN Mismatch - Employee Record" },
                    { ref: "SARIE-260522-007988", rail: "SARIE", customer: "Retail - TXN-RET-90412", amount: "SAR 4,800", age: "1h 02m", status: "Post-Processing", reason: "Beneficiary Account Closed" }
                ]
            });

            oView.setModel(oApprovalModel, "approvalModel");
            oView.setModel(oPostProcessingModel, "postProcessingModel");
            oView.setModel(oRejectedModel, "rejectedModel");

            this._createInfoModel(oApprovalModel.getProperty("/data"), "approvalInfoModel");
            this._createInfoModel(oPostProcessingModel.getProperty("/data"), "postProcessingInfoModel");
            this._createInfoModel(oRejectedModel.getProperty("/data"), "rejectedInfoModel");

            var oRailSelect = this.byId("filterRail");
            if (oRailSelect) {
                [["ALL", "All"], ["SARIE", "SARIE"], ["SWIFT", "SWIFT"], ["WPS", "WPS"]].forEach(function (a) {
                    oRailSelect.addItem(new sap.ui.core.Item({ key: a[0], text: a[1] }));
                });
            }

            var oStatusSelect = this.byId("filterStatus");
            if (oStatusSelect) {
                [["ALL", "All"], ["OPEN", "Open"], ["PROCESSING", "Processing"], ["REJECTED", "Rejected"]].forEach(function (a) {
                    oStatusSelect.addItem(new sap.ui.core.Item({ key: a[0], text: a[1] }));
                });
            }

            oView.setModel(new JSONModel({
                data: [
                    { entity: "Ministry of Finance", rail: "SARIE", open: 18, value: "86.0M", note: "Mid-month disbursement", aged: "3h 02m", status: "Action Needed", statusColor: "Warning" },
                    { entity: "GOSI", rail: "SARIE", open: 12, value: "24.4M", note: "Settlement ACK pending", aged: "58m", status: "Awaiting", statusColor: "Information" },
                    { entity: "Ministry of Education", rail: "SARIE", open: 8, value: "24.0M", note: "Payroll batch approval", aged: "1h 44m", status: "Action Needed", statusColor: "Warning" },
                    { entity: "Ministry of Interior", rail: "WPS", open: 4, value: "8.3M", note: "Threshold approval", aged: "12m", status: "Action Needed", statusColor: "Warning" },
                    { entity: "Saudi Customs", rail: "SARIE", open: 3, value: "4.8M", note: "VAT refund ACK pending", aged: "42m", status: "Awaiting", statusColor: "Information" },
                    { entity: "Public Investment Fund", rail: "SWIFT", open: 2, value: "142.0M", note: "Beneficiary screening hold", aged: "4h 18m", status: "Escalated", statusColor: "Error" }
                ]
            }), "govExceptionsModel");

            oView.setModel(new JSONModel({ data: [], total: 0, maxAge: "", maxAmount: "" }), "openExceptionModel");
            oView.setModel(new JSONModel({ total: 0, maxAge: "", maxAmount: "" }), "startupInfoModel");

            oView.setModel(new JSONModel({
                data: [
                    { programme: "Ministry of Education", employees: 42, amount: "SAR 2,104,000", reason: "Account closed - CR update pending", aged: "32m", agedState: "None" },
                    { programme: "Aramco Trading Company", employees: 8, amount: "SAR 384,000", reason: "Insufficient funds in salary account", aged: "1h 04m", agedState: "Warning" },
                    { programme: "Saudi Telecom Company (STC)", employees: 3, amount: "SAR 142,000", reason: "IBAN mismatch - employee record", aged: "44m", agedState: "None" },
                    { programme: "Almarai Company", employees: 1, amount: "SAR 18,400", reason: "Sanctions hit - false-positive review", aged: "12m", agedState: "None" },
                    { programme: "Ministry of Interior - Allowance", employees: 184, amount: "SAR 8,280,000", reason: "Batch awaiting 4-eyes approval", aged: "8m", agedState: "None" },
                    { programme: "Saudi Binladin Group", employees: 22, amount: "SAR 1,026,400", reason: "Off-cycle batch - verify with HR", aged: "2h 12m", agedState: "Error" },
                    { programme: "Bahri Maritime", employees: 6, amount: "SAR 312,000", reason: "GOSI registration expired", aged: "1h 38m", agedState: "Warning" }
                ]
            }), "wpsExceptionModel");

            oView.setModel(new JSONModel({
                data: [
                    { operator: "Anna Al-Becker", role: "Team Lead", assigned: 142, resolved: 312, sla: 2, util: 84, status: "Available" },
                    { operator: "Faisal Al-Otaibi", role: "Sr. Ops", assigned: 118, resolved: 264, sla: 1, util: 92, status: "On Case" },
                    { operator: "Reem Al-Shahrani", role: "Ops", assigned: 96, resolved: 218, sla: 0, util: 89, status: "On Case" }
                ]
            }), "teamWorkloadModel");

            oView.setModel(new JSONModel({
                data: [
                    { title: "PF · SWIFT screening hit", details: "MT103-260522-014288 · Compliance Hold · 1h 42m ago", amount: "SAR 142,000,000" },
                    { title: "MoF · Disbursement above limit", details: "SARIE-260522-008142 · Operations Hold · 32m ago", amount: "SAR 86,000,000" },
                    { title: "MoI hardship allowance · eligibility", details: "WPS-260522-MOI-031 · WPS Compliance · 12m ago", amount: "SAR 8,280,000" },
                    { title: "Binladin Group · NAK - Invalid BIC", details: "MT103-260522-014008 · SWIFT Operations · 4h 22m ago", amount: "SAR 1,026,400" },
                    { title: "End-of-day mismatch - GOSI", details: "SARIE-260522-007982 · Reconciliation · 8m ago", amount: "SAR 412,000" }
                ]
            }), "escalationModel");

            // Load everything LAST, after every model exists.
            // (View1 re-triggers these via _refreshExceptionKpis once filters are set.)
            this.loadExceptionKpis();
            this.loadExceptionReasons();
            this.loadExceptionTrend();
            this.loadRailKpi();
            this._attachKpiCardClicks();
        },

        /* ================= FORMATTERS ================= */

        formatObjectCategory: function (s) {
            if (s === "05") { return "05 Ordering party"; }
            if (s === "06") { return "06 Recipient Item"; }
            return s || "";
        },

        formatExceptionStatus: function (sStatus) {
            if (!sStatus) { return "None"; }
            switch (String(sStatus).toUpperCase()) {
                case "OPEN": return "Warning";
                case "PROCESSING": return "Information";
                case "REJECTED": return "Error";
                case "RESOLVED": return "Success";
                default: return "None";
            }
        },

        formatGovStatusIcon: function (s) {
            switch (s) {
                case "Action Needed": return "sap-icon://alert";
                case "Awaiting": return "sap-icon://information";
                case "Escalated": return "sap-icon://decline";
                default: return "";
            }
        },

        formatGovStatusState: function (s) {
            switch (s) {
                case "Action Needed": return "Warning";
                case "Awaiting": return "Information";
                case "Escalated": return "Error";
                default: return "None";
            }
        },

        formatWorkloadStatus: function (s) {
            switch (s) {
                case "Available": return "Success";
                case "On Case": return "Information";
                case "Busy": return "Warning";
                default: return "None";
            }
        },

        formatWorkloadIcon: function (s) {
            if (s === "On Case") { return "sap-icon://busy"; }
            if (s === "Available") { return "sap-icon://employee"; }
            return "sap-icon://status-in-process";
        },

        formatAgeState: function (sAge, sMaxAge) {
            if (!sAge || !sMaxAge) { return "None"; }
            return sAge === sMaxAge ? "Error" : "None";
        },

        formatRailBadge: function (sRail) {
            if (sRail === "SWIFT") { return "<span class='railSwift'>SWIFT</span>"; }
            if (sRail === "SARIE") { return "<span class='railSarie'>SARIE</span>"; }
            if (sRail === "WPS") { return "<span class='railWps'>WPS</span>"; }
            return sRail;
        },

        // NOTE: the € prefix is hardcoded. Change to "SAR " if the data is in riyals.
        formatValueAtRisk: function (vValue) {
            var f = Number(vValue) || 0;
            if (f >= 1000000) { return + (f / 1000000).toFixed(1) + "M"; }
            if (f >= 1000) { return (f / 1000).toFixed(1) + "K"; }
            return f.toLocaleString();
        }
        ,
        _getTrendText: function (oTrend) {
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            if (!oTrend || !oTrend.hasData) { return oBundle.getText("kpiInsufficientData"); }
            if (oTrend.direction === "flat") { return oBundle.getText("kpiNoChange"); }
            var sKey = oTrend.direction === "up" ? "kpiTrendUp" : "kpiTrendDown";
            return oBundle.getText(sKey, [oTrend.percent.toFixed(1)]);
        },

        formatOpenExceptionTrendText: function (oTrend) { return this._getTrendText(oTrend); },
        formatValueAtRiskTrendText: function (oTrend) { return this._getTrendText(oTrend); },

        formatOpenExceptionTrendClass: function (oTrend) {
            if (!oTrend || !oTrend.hasData || oTrend.direction === "flat") { return "kpiCardSubtext"; }
            return oTrend.direction === "up"
                ? "kpiCardSubtext kpiCardSubtextWarn"
                : "kpiCardSubtext kpiCardSubtextGood";
        },

        formatValueAtRiskTrendClass: function (oTrend) {
            if (!oTrend || !oTrend.hasData || oTrend.direction === "flat") { return "kpiCardSubtext"; }
            return oTrend.direction === "up"
                ? "kpiCardSubtext kpiCardSubtextWarn"
                : "kpiCardSubtext kpiCardSubtextGood";
        },

        /* ================= HELPERS ================= */

        _normalizeDate: function (vDate) {
            if (!vDate) { return ""; }
            if (vDate instanceof Date) {
                return vDate.getFullYear() + "-" +
                    String(vDate.getMonth() + 1).padStart(2, "0") + "-" +
                    String(vDate.getDate()).padStart(2, "0");
            }
            return String(vDate).slice(0, 10);
        },

        _getFilterModel: function () {
            return this.getView().getModel("filterModel") ||
                this.getOwnerComponent().getModel("filterModel");
        },

        _getPreviousDateStr: function (sDate) {
            var p = String(sDate).slice(0, 10).split("-");
            var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
            d.setDate(d.getDate() - 1);
            return this._normalizeDate(d);
        },

        _computeTrend: function (fCurrent, fPrevious) {
            fCurrent = Number(fCurrent) || 0;
            fPrevious = Number(fPrevious) || 0;
            if (fCurrent === 0) { return { percent: 0, direction: "flat", hasData: false }; }
            var fPercent = Math.max(-100, Math.min(100, ((fCurrent - fPrevious) / fCurrent) * 100));
            return {
                percent: Math.abs(fPercent),
                direction: fPercent > 0 ? "up" : (fPercent < 0 ? "down" : "flat"),
                hasData: true
            };
        },

        _createInfoModel: function (aData, sModelName) {
            var iMaxAmount = 0;
            var sMaxAge = "";

            function ageToMinutes(sAge) {
                var iMin = 0;
                var oH = String(sAge).match(/(\d+)\s*h/i);
                var oM = String(sAge).match(/(\d+)\s*m/i);
                if (oH) { iMin += parseInt(oH[1], 10) * 60; }
                if (oM) { iMin += parseInt(oM[1], 10); }
                return iMin;
            }

            aData.forEach(function (oItem) {
                var iAmount = Number(
                    oItem.amount.replace("SAR", "").replace(/,/g, "").replace("M", "000000").trim()
                );
                if (iAmount > iMaxAmount) { iMaxAmount = iAmount; }
                if (!sMaxAge || ageToMinutes(oItem.age) > ageToMinutes(sMaxAge)) { sMaxAge = oItem.age; }
            });

            this.getView().setModel(new JSONModel({
                total: aData.length,
                maxAmount: "SAR " + iMaxAmount.toLocaleString(),
                maxAge: sMaxAge
            }), sModelName);
        },

        /* ================= SEARCH / FILTERS ================= */

        onGlobalSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || "";
            var oTable = this.byId("_IDGenTable4");
            var oBinding = oTable ? oTable.getBinding("items") : null;

            if (oBinding) {
                if (!sQuery) {
                    oBinding.filter([]);
                } else {
                    oBinding.filter(new Filter({
                        filters: [
                            new Filter("ref", "Contains", sQuery),
                            new Filter("customer", "Contains", sQuery),
                            new Filter("amount", "Contains", sQuery),
                            new Filter("reason", "Contains", sQuery),
                            new Filter("rail", "Contains", sQuery)
                        ],
                        and: false
                    }));
                }
            }
            this.onFilterChange();
        },

        onFilterChange: function () {

            var fnKey = function (oCtrl, sDefault) {
                return oCtrl ? oCtrl.getSelectedKey() : sDefault;
            };

            var sObjectCategory = fnKey(this.byId("filterObjectCategory"), "ALL_OBJECT_CATEGORY");
            var sStatus = fnKey(this.byId("filterStatus"), "ALL");
            var sAging = fnKey(this.byId("filterAging"), "ALL_AGE");
            var sCurrency = fnKey(this.byId("filterCurrency"), "ALL_CURRENCY");
            var sReason = fnKey(this.byId("filterReason"), "ALL_REASON");

            var oSearch = this.byId("_IDGenSearchField1");
            var sSearch = oSearch ? oSearch.getValue() : "";

            var aFilters = [];

            if (sObjectCategory && sObjectCategory !== "ALL_OBJECT_CATEGORY") {
                aFilters.push(new Filter("ObjectCategory", FilterOperator.EQ, sObjectCategory));
            }
            if (sStatus && sStatus !== "ALL") {
                aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus));
            }
            if (sAging && sAging !== "ALL_AGE") {
                aFilters.push(new Filter("Aged", FilterOperator.EQ, sAging));
            }
            if (sCurrency && sCurrency !== "ALL_CURRENCY") {
                aFilters.push(new Filter("CURRENCY", FilterOperator.EQ, sCurrency));
            }
            if (sReason && sReason !== "ALL_REASON") {
                aFilters.push(new Filter("ReasonDetail", FilterOperator.EQ, sReason));
            }
            if (sSearch) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Reference", FilterOperator.Contains, sSearch),
                        new Filter("CounterParty", FilterOperator.Contains, sSearch),
                        new Filter("Amount", FilterOperator.Contains, sSearch),
                        new Filter("ReasonDetail", FilterOperator.Contains, sSearch),
                        new Filter("ObjectCategory", FilterOperator.Contains, sSearch),
                        new Filter("Aged", FilterOperator.Contains, sSearch),
                        new Filter("PaymentItemNumber", FilterOperator.Contains, sSearch)
                    ],
                    and: false
                }));
            }

            var oTable = this.byId("_IDGenTable3");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (!oBinding) { return; }

            oBinding.filter(aFilters);

            // Updates only the table header (Open / Highest / Max age).
            // The KPI tile always shows the full day's total from ExceptionKPI.
            setTimeout(function () {
                this._updateOpenExceptionCount(oBinding);
            }.bind(this), 0);
        },

        onToggleManager: function () {
            var oContent = this.byId("managerContent");
            var oButton = this.byId("managerHeader");
            if (!oContent || !oButton) { return; }
            var bVisible = oContent.getVisible();
            oContent.setVisible(!bVisible);
            oButton.setIcon(bVisible ? "sap-icon://slim-arrow-right" : "sap-icon://slim-arrow-down");
        },

        // Rebuilds a dropdown but keeps the user's selection if it still exists.
        _fillSelect: function (oSelect, sAllKey, sAllText, aValues) {
            if (!oSelect) { return; }
            var sPrevious = oSelect.getSelectedKey();
            oSelect.removeAllItems();
            oSelect.addItem(new sap.ui.core.Item({ key: sAllKey, text: sAllText }));
            aValues.forEach(function (sValue) {
                oSelect.addItem(new sap.ui.core.Item({ key: sValue, text: sValue }));
            });
            oSelect.setSelectedKey(aValues.indexOf(sPrevious) > -1 ? sPrevious : sAllKey);
        },

        _populateFilterDropdowns: function () {
            var oModel = this.getView().getModel("openExceptionModel");
            if (!oModel) { return; }

            var aData = oModel.getProperty("/data") || [];

            var fnUnique = function (sField) {
                return Array.from(new Set(
                    aData
                        .map(function (o) { return o[sField]; })
                        .filter(function (v) { return v !== null && v !== undefined && String(v).trim() !== ""; })
                        .map(function (v) { return String(v).trim(); })
                ));
            };

            this._fillSelect(this.byId("filterObjectCategory"), "ALL_OBJECT_CATEGORY", "All", fnUnique("ObjectCategory"));
            this._fillSelect(this.byId("filterStatus"), "ALL", "All", fnUnique("Status"));
            this._fillSelect(this.byId("filterAging"), "ALL_AGE", "All Age", fnUnique("Aged"));
            this._fillSelect(this.byId("filterCurrency"), "ALL_CURRENCY", "All", fnUnique("CURRENCY"));
            this._fillSelect(this.byId("filterReason"), "ALL_REASON", "All", fnUnique("ReasonDetail"));
        },

        _applyFiltersToOpenExceptionTable: function (aFilters) {
            var oTable = this.byId("_IDGenTable3");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (!oBinding) { return; }
            oBinding.filter(aFilters);
        },

        /* ================= KPI TILE (ExceptionKPI) + TABLE (EXCEPTIONDetail) ================= */

        // Public. Called on init and from View1._refreshExceptionKpis().
        loadExceptionKpis: function () {

            // Table + count (EXCEPTIONDetail)
            this.loadOpenExceptionDetails();

            // Value at Risk = sum of ValueAtRisk over ExceptionKPI rows
            var oKpiModel = this.getView().getModel("exceptionKpiModel");
            var oFilterModel = this._getFilterModel();
            if (!oKpiModel || !oFilterModel) { return; }

            var sArea = oFilterModel.getProperty("/clearingArea");
            var sPosting = this._normalizeDate(oFilterModel.getProperty("/kpiDate"));
            var sCreated = this._normalizeDate(oFilterModel.getProperty("/createdOn"));
            if (!sArea || !sPosting) { return; }

            var sFilter = "clearingarea eq '" + String(sArea).replace(/'/g, "''") + "'" +
                " and paymentorderdate eq " + sPosting;
            if (sCreated) { sFilter += " and createdate eq " + sCreated; }

            fetch(SERVICE_URL + "ExceptionKPI?$filter=" + encodeURIComponent(sFilter), {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            })
                .then(function (r) {
                    if (!r.ok) { throw new Error("HTTP " + r.status); }
                    return r.json();
                })
                .then(function (oData) {
                    var fValue = 0;
                    (oData.value || []).forEach(function (o) {
                        fValue += Number(o.ValueAtRisk) || 0;
                    });
                    console.log("ExceptionKPI rows:", oData.value, "=> value:", fValue);
                    oKpiModel.setProperty("/ValueAtRisk", fValue);
                    oKpiModel._valueFromKpi = true;
                })
                .catch(function (e) {
                    console.error("ExceptionKPI failed:", e);
                });
        },

        loadOpenExceptionDetails: function () {

            var oOpenExceptionModel = this.getView().getModel("openExceptionModel");
            if (!oOpenExceptionModel) {
                console.error("openExceptionModel not found");
                return;
            }

            var oFilterModel = this._getFilterModel();
            if (!oFilterModel) {
                console.warn("Open Exception Detail: filterModel not available yet");
                return;
            }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sDate = this._normalizeDate(oFilterModel.getProperty("/kpiDate"));
            var sCreatedOn = this._normalizeDate(oFilterModel.getProperty("/createdOn"));

            if (!sClearingArea || !sDate) {
                console.warn("Open Exception Detail: clearing area or date missing");
                return;
            }

            var sFilter =
                "ClearingArea eq '" + String(sClearingArea).replace(/'/g, "''") + "'" +
                " and PaymentItemDate eq " + sDate;

            // Created On maps to backend field crdat
            if (sCreatedOn) {
                sFilter += " and crdat eq " + sCreatedOn;
            }

            var sUrl =
                SERVICE_URL + "EXCEPTIONDetail" +
                "?$filter=" + encodeURIComponent(sFilter) +
                "&$select=" + [
                    "ClearingArea", "PaymentItemDate", "PaymentItemGuid", "ObjectCategory",
                    "po_type", "po_typet_s", "tech_stat", "Status", "PaymentItemNumber",
                    "Reference", "ReasonDetail", "Amount", "CURRENCY", "Aged", "CounterParty"
                ].join(",");

            console.log("EXCEPTIONDetail filter:", sFilter);

            var that = this;

            fetch(sUrl, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            })
                .then(function (oResponse) {
                    if (!oResponse.ok) {
                        throw new Error("HTTP " + oResponse.status + " - " + oResponse.statusText);
                    }
                    return oResponse.json();
                })
                .then(function (oData) {

                    var aRows = oData.value || [];

                    console.log("EXCEPTIONDetail raw rows:", aRows.length);

                    // Show every row the service returns (no dedupe)
                    var aUniqueRows = aRows;

                    var oKpiModel = that.getView().getModel("exceptionKpiModel");
                    oKpiModel.setProperty("/OpenException", aUniqueRows.length);   // count only

                    oOpenExceptionModel.setProperty("/data", aUniqueRows);

                    that._calculateOpenExceptionStats(aUniqueRows);
                    that._populateFilterDropdowns();

                    oOpenExceptionModel.refresh(true);

                    // Re-apply any active dropdown/search filter to the new data
                    that.onFilterChange();
                })
                .catch(function (oError) {
                    console.error("EXCEPTIONDetail fetch failed:", oError);
                    oOpenExceptionModel.setProperty("/data", []);
                    oOpenExceptionModel.setProperty("/total", 0);
                    oOpenExceptionModel.refresh(true);
                });
        },

        onOpenExceptionsPress: function () {
            this.loadOpenExceptionDetails();
        },

        _updateOpenExceptionCount: function (oBinding) {
            if (!oBinding) { return; }
            var aContexts = oBinding.getCurrentContexts ? oBinding.getCurrentContexts() : [];
            var aRows = aContexts.map(function (c) { return c.getObject(); });
            this._writeOpenExceptionStats(aRows, true);
        },

        _calculateOpenExceptionStats: function (aRows) {
            this._writeOpenExceptionStats(aRows, false);
        },

        // Row count, oldest age, and highest single amount (currency from that same row).
        _writeOpenExceptionStats: function (aRows, bFromBinding) {

            var iTotal = aRows.length;
            var iMaxAmount = 0;
            var sMaxCurrency = "";
            var sMaxAge = "";
            var iMaxMinutes = -1;

            var ageToMinutes = function (sAge) {
                if (!sAge) { return 0; }
                sAge = String(sAge).trim();
                var iMin = 0;
                var oH = sAge.match(/(\d+)\s*h/i);
                var oM = sAge.match(/(\d+)\s*m/i);
                if (oH) { iMin += parseInt(oH[1], 10) * 60; }
                if (oM) { iMin += parseInt(oM[1], 10); }
                return iMin;
            };

            var amountToNumber = function (v) {
                if (v === null || v === undefined || v === "") { return 0; }
                return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
            };

            aRows.forEach(function (oRow) {
                var sAge = oRow.Aged || "";
                var iMinutes = ageToMinutes(sAge);
                if (iMinutes > iMaxMinutes) {
                    iMaxMinutes = iMinutes;
                    sMaxAge = sAge;
                }

                var iAmount = amountToNumber(oRow.Amount);
                if (iAmount > iMaxAmount) {
                    iMaxAmount = iAmount;
                    sMaxCurrency = String(oRow.CURRENCY || "").trim().toUpperCase();
                }
            });

            var oModel = this.getView().getModel("openExceptionModel");
            if (!oModel) { return; }

            oModel.setProperty("/total", iTotal);
            oModel.setProperty("/maxAge", sMaxAge);
            oModel.setProperty("/maxAmount", this._formatCurrencyAmount(iMaxAmount, sMaxCurrency));

            // refresh(true) would re-trigger the binding's filter; only needed for the full load
            if (!bFromBinding) {
                oModel.refresh(true);
            }
        },

        _formatCurrencyAmount: function (iAmount, sCurrency) {
            var mSymbols = { EUR: "€", USD: "$", GBP: "£", INR: "₹", SAR: "﷼" };
            var sCode = String(sCurrency || "").trim().toUpperCase();
            var sSymbol = mSymbols[sCode] || (sCode ? sCode + " " : "");
            return sSymbol + Number(iAmount || 0).toLocaleString();
        },

        _attachKpiCardClicks: function () {
            var oCard = this.byId("_IDGenKpiOpenExceptions");
            if (!oCard) { return; }
            if (oCard.data("clickBound")) { return; }
            oCard.attachBrowserEvent("click", this.onOpenExceptionsPress, this);
            oCard.data("clickBound", true);
        },

        /* ================= BY RAIL ================= */

        loadRailKpi: function () {

            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this._getFilterModel();
            var oRailModel = this.getView().getModel("railModel");

            if (!oODataModel || !oRailModel || !oFilterModel) { return; }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sDate = this._normalizeDate(oFilterModel.getProperty("/kpiDate"));

            if (!sClearingArea || !sDate) { return; }

            var oListBinding;

            try {
                oListBinding = oODataModel.bindList("/RailKpi", undefined, undefined, undefined, {
                    $select: "ClearingArea,PaymentItemDate,OnHold,InPostProcessing,Rejected"
                });
            } catch (oBindError) {
                console.error("Rail KPI: bindList() threw", oBindError);
                oRailModel.setData({ data: [], total: 0, totalText: oBundle.getText("openItemsZero") });
                return;
            }

            var that = this;

            oListBinding.requestContexts(0, 5000).then(function (aContexts) {

                var aRows = aContexts.map(function (c) { return c.getObject(); });

                // Client-side match (service has casing quirks on filter names)
                var oMatch = aRows.find(function (oRow) {
                    return oRow.ClearingArea === sClearingArea &&
                        that._normalizeDate(oRow.PaymentItemDate) === sDate;
                });

                if (!oMatch) {
                    console.warn("Rail KPI: no matching row for", sClearingArea, sDate);
                }

                var iHold = oMatch ? (Number(oMatch.OnHold) || 0) : 0;
                var iPost = oMatch ? (Number(oMatch.InPostProcessing) || 0) : 0;
                var iRejected = oMatch ? (Number(oMatch.Rejected) || 0) : 0;
                var iTotal = iHold + iPost + iRejected;

                function toPercent(v) {
                    return iTotal > 0 ? Math.min(Math.round((v / iTotal) * 100), 100) : 0;
                }

                oRailModel.setData({
                    data: [
                        { status: "On Hold", value: iHold, percent: toPercent(iHold) },
                        { status: "In Post-Processing", value: iPost, percent: toPercent(iPost) },
                        { status: "Rejected", value: iRejected, percent: toPercent(iRejected) }
                    ],
                    total: iTotal,
                    totalText: oBundle.getText("openItemsByClearingArea", [iTotal, sClearingArea])
                });

            }).catch(function (oError) {
                console.error("Rail KPI load failed:", oError);
                oRailModel.setData({ data: [], total: 0, totalText: oBundle.getText("openItemsZero") });
            });
        },

        onRailChartTypeMenuPress: function (oEvent) {
            var oButton = oEvent.getSource();

            if (!this._oRailChartTypeMenu) {
                var aItems = Object.keys(RAIL_CHART_TYPE_CONFIG).map(function (sKey) {
                    var oConfig = RAIL_CHART_TYPE_CONFIG[sKey];
                    var oItem = new sap.m.MenuItem({ text: oConfig.label, icon: oConfig.icon });
                    oItem.data("configKey", sKey);
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

        onRailChartTypeSelected: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var oConfig = RAIL_CHART_TYPE_CONFIG[oItem.data("configKey")];
            if (!oConfig) { return; }

            this.getView().getModel("railViewModel").setProperty("/chartType", oConfig.chartType);

            var oButton = this.byId("railChartTypeButton");
            if (oButton) {
                oButton.setIcon(oConfig.icon);
                oButton.setTooltip(oConfig.label);
            }
        },

        onToggleRailChartType: function () {
            var oViewModel = this.getView().getModel("railViewModel");
            if (!oViewModel) { return; }

            var sNewType = oViewModel.getProperty("/chartType") === "pie" ? "progress" : "pie";
            oViewModel.setProperty("/chartType", sNewType);

            var oButton = this.byId("railChartTypeButton");
            if (oButton) {
                if (sNewType === "progress") {
                    oButton.setIcon("sap-icon://pie-chart");
                    oButton.setTooltip("Show Pie Chart");
                } else {
                    oButton.setIcon("sap-icon://horizontal-bar-chart-2");
                    oButton.setTooltip("Show Progress Bar");
                }
            }
        },

        onRailPieSelect: function (oEvent) {
            var oData = oEvent.getParameter("data");
            if (!oData || !oData.length) { return; }

            var oPoint = oData[0];
            var sStatus = "";
            var iCount = 0;

            if (oPoint.data) {
                sStatus = oPoint.data.Status || oPoint.data.status || "";
                iCount = Number(oPoint.data.Count || oPoint.data.value || 0);
            }

            var oRailModel = this.getView().getModel("railModel");
            oRailModel.setProperty("/selectedStatus", sStatus);
            oRailModel.setProperty("/selectedCount", iCount);
        },

        /* ================= EXCEPTION TREND ================= */

        loadExceptionTrend: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this._getFilterModel();
            var oTrendModel = this.getView().getModel("trendModel");

            if (!oODataModel || !oTrendModel || !oFilterModel) { return; }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sSelectedDate = this._normalizeDate(oFilterModel.getProperty("/kpiDate"));

            if (!sClearingArea || !sSelectedDate) { return; }

            // PaymentOrderDate is a BUSINESS DATE: never use toISOString()
            var p = sSelectedDate.split("-");
            var oEndDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));

            var aMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var that = this;

            var oStartDate = new Date(oEndDate);
            oStartDate.setDate(oStartDate.getDate() - 6);

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("PaymentOrderDate", FilterOperator.GE, this._normalizeDate(oStartDate)),
                new Filter("PaymentOrderDate", FilterOperator.LE, this._normalizeDate(oEndDate))
            ];

            var oListBinding = oODataModel.bindList(
                "/DailyExceptionTrend", undefined, undefined, aFilters,
                { $select: "ClearingArea,PaymentOrderDate,Opened,Resolved" }
            );

            oListBinding.requestContexts(0, 5000)
                .then(function (aContexts) {

                    var mByDate = {};

                    aContexts.forEach(function (oContext) {
                        var oRow = oContext.getObject();
                        var sDate = that._normalizeDate(oRow.PaymentOrderDate);
                        mByDate[sDate] = {
                            opened: Number(oRow.Opened) || 0,
                            resolved: Number(oRow.Resolved) || 0
                        };
                    });

                    var aTrendData = [];

                    for (var i = 0; i < 7; i++) {
                        var oDate = new Date(oStartDate);
                        oDate.setDate(oStartDate.getDate() + i);

                        var sISO = that._normalizeDate(oDate);
                        var oValues = mByDate[sISO] || { opened: 0, resolved: 0 };

                        aTrendData.push({
                            date: sISO,
                            dateLabel: aMonths[oDate.getMonth()] + " " + oDate.getDate(),
                            opened: oValues.opened,
                            resolved: oValues.resolved
                        });
                    }

                    oTrendModel.setProperty("/data", aTrendData);
                    oTrendModel.setProperty("/warning", that._getTrendWarningMessage(aTrendData));
                    oTrendModel.refresh(true);

                    if (that.byId("_IDGenVizFrame")) {
                        // Re-apply the active chart type (not always "bar")
                        that._applyTrendChartType(that._sActiveTrendConfigKey || "bar");
                    }
                })
                .catch(function (oError) {
                    console.error("Exception Trend OData load failed:", oError);
                });
        },

        _getTrendWarningMessage: function (aTrendData) {

            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();

            if (!aTrendData || aTrendData.length === 0) {
                return { type: "Information", message: oBundle.getText("noTrendData") };
            }

            var oToday = aTrendData[aTrendData.length - 1];
            var iOpened = Number(oToday.opened) || 0;
            var iResolved = Number(oToday.resolved) || 0;
            var iDifference = Math.abs(iOpened - iResolved);

            var iGrowingDays = 0;
            for (var i = aTrendData.length - 1; i >= 0; i--) {
                if ((Number(aTrendData[i].opened) || 0) > (Number(aTrendData[i].resolved) || 0)) {
                    iGrowingDays++;
                } else {
                    break;
                }
            }

            if (iOpened > iResolved) {
                return {
                    type: "Warning",
                    message: iGrowingDays > 1
                        ? oBundle.getText("backlogGrowingDays", [iOpened, iResolved, iDifference, iGrowingDays])
                        : oBundle.getText("backlogGrowing", [iOpened, iResolved, iDifference])
                };
            }

            if (iResolved > iOpened) {
                return {
                    type: "Success",
                    message: oBundle.getText("backlogImproving", [iResolved, iOpened, iDifference])
                };
            }

            return { type: "Information", message: oBundle.getText("backlogStable", [iOpened]) };
        },

        /* ================= EXCEPTION REASONS ================= */

        loadExceptionReasons: function () {

            var oODataModel = this.getOwnerComponent().getModel("odataModel");
            var oFilterModel = this._getFilterModel();
            var oReasonModel = this.getView().getModel("reasonModel");

            if (!oODataModel || !oReasonModel || !oFilterModel) { return; }

            var sClearingArea = oFilterModel.getProperty("/clearingArea");
            var sDate = this._normalizeDate(oFilterModel.getProperty("/kpiDate"));

            if (!sClearingArea || !sDate) { return; }

            var aFilters = [
                new Filter("ClearingArea", FilterOperator.EQ, sClearingArea),
                new Filter("PaymentOrderDate", FilterOperator.EQ, sDate)
            ];

            var oListBinding = oODataModel.bindList("/ExceptionsByReason", undefined, undefined, aFilters, {
                $select: "ClearingArea,PaymentOrderDate,CheckTextShort,Exceptions"
            });

            oListBinding.requestContexts(0, 5000).then(function (aContexts) {

                var mGrouped = {};
                var iCriticalTotal = 0;

                aContexts.forEach(function (oContext) {
                    var oRow = oContext.getObject();
                    var sReason = (oRow.CheckTextShort || "").trim();
                    if (!sReason) { return; }

                    var iExceptions = Number(oRow.Exceptions) || 0;
                    iCriticalTotal += iExceptions;
                    mGrouped[sReason] = (mGrouped[sReason] || 0) + iExceptions;
                });

                var aGrouped = Object.keys(mGrouped).map(function (s) {
                    return { reason: s, value: mGrouped[s] };
                });

                aGrouped.sort(function (a, b) { return b.value - a.value; });

                var aStates = ["Positive", "Information", "Critical", "Negative", "Negative"];

                var aTopReasons = aGrouped.slice(0, 5).map(function (oRow, iIndex) {
                    return {
                        rank: iIndex + 1,
                        reason: oRow.reason,
                        value: oRow.value,
                        displayValue: oRow.value >= 1000
                            ? (oRow.value / 1000).toFixed(1) + "K"
                            : String(oRow.value),
                        percent: Math.min(oRow.value, 100),
                        state: aStates[iIndex] || "Negative"
                    };
                });

                oReasonModel.setProperty("/topReasons", aTopReasons);
                oReasonModel.setProperty("/criticalTotal", iCriticalTotal);

            }).catch(function (oError) {
                console.error("Exception Reasons load failed:", oError);
                oReasonModel.setProperty("/topReasons", []);
            });
        },

        /* ================= TREND CHART TYPES ================= */

        onTrendChartTypeMenuPress: function (oEvent) {
            var oButton = oEvent.getSource();

            if (!this._oTrendChartTypeMenu) {
                var aItems = Object.keys(TREND_CHART_TYPE_CONFIG).map(function (sKey) {
                    var oConfig = TREND_CHART_TYPE_CONFIG[sKey];
                    var oItem = new sap.m.MenuItem({ text: oConfig.label, icon: oConfig.icon });
                    oItem.data("configKey", sKey);
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
            var sKey = oEvent.getParameter("item").data("configKey");
            if (sKey) { this._applyTrendChartType(sKey); }
        },

        _applyTrendChartType: function (sConfigKey) {
            var oConfig = TREND_CHART_TYPE_CONFIG[sConfigKey];
            var oChart = this.byId("_IDGenVizFrame");
            if (!oConfig || !oChart) { return; }

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

        _getTrendOpenedResolvedTotals: function () {
            var aData = this.getView().getModel("trendModel").getProperty("/data") || [];
            var iOpened = 0, iResolved = 0;
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
            var aData = this.getView().getModel("trendModel").getProperty("/data") || [];
            var aOut = [];
            aData.forEach(function (o) {
                aOut.push({ Day: o.dateLabel, Type: "Opened", Value: Number(o.opened) || 0 });
                aOut.push({ Day: o.dateLabel, Type: "Resolved", Value: Number(o.resolved) || 0 });
            });
            return aOut;
        },

        _applyTrendAxisChartType: function (sVizType) {

            var oChart = this.byId("_IDGenVizFrame");
            if (!oChart || !this.getView().getModel("trendModel")) { return; }

            oChart.removeAllFeeds();

            oChart.setDataset(new FlattenedDataset({
                dimensions: [{ name: "Date", value: "{trendModel>dateLabel}" }],
                measures: [
                    { name: "Opened", value: "{trendModel>opened}" },
                    { name: "Resolved", value: "{trendModel>resolved}" }
                ],
                data: { path: "trendModel>/data" }
            }));

            oChart.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Opened", "Resolved"] }));
            oChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Date"] }));

            oChart.setVizType(sVizType || "bar");

            oChart.setVizProperties({
                title: { visible: false },
                legend: { visible: true, position: "bottom", alignment: "center" },
                plotArea: { colorPalette: ["#c17b74", "#7a9e6f"] },
                categoryAxis: { title: { visible: false }, label: { visible: true } },
                valueAxis: { title: { visible: false }, label: { visible: true } }
            });

            oChart.invalidate();
        },

        _applyTrendShareChartType: function (sVizType) {
            var oChart = this.byId("_IDGenVizFrame");

            this.getView().getModel("trendModel").setProperty("/openedResolvedShare", this._getTrendOpenedResolvedTotals());

            oChart.removeAllFeeds();
            oChart.setDataset(new FlattenedDataset({
                dimensions: [{ name: "Category", value: "{trendModel>Category}" }],
                measures: [{ name: "Total", value: "{trendModel>Total}" }],
                data: { path: "trendModel>/openedResolvedShare" }
            }));
            oChart.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["Total"] }));
            oChart.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Category"] }));

            oChart.setVizType(sVizType);
            oChart.setVizProperties({ plotArea: { colorPalette: ["#c17b74", "#7a9e6f"] } });
        },

        _applyTrendHeatmapChartType: function () {
            var oChart = this.byId("_IDGenVizFrame");

            this.getView().getModel("trendModel").setProperty("/heatmapData", this._getTrendHeatmapData());

            oChart.removeAllFeeds();
            oChart.setDataset(new FlattenedDataset({
                dimensions: [
                    { name: "Day", value: "{trendModel>Day}" },
                    { name: "Type", value: "{trendModel>Type}" }
                ],
                measures: [{ name: "Value", value: "{trendModel>Value}" }],
                data: { path: "trendModel>/heatmapData" }
            }));
            oChart.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Day"] }));
            oChart.addFeed(new FeedItem({ uid: "categoryAxis2", type: "Dimension", values: ["Type"] }));
            oChart.addFeed(new FeedItem({ uid: "color", type: "Measure", values: ["Value"] }));

            oChart.setVizType("heatmap");
        },

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
                        this._oOriginalTrendParent.insertItem(oCard, this._iOriginalTrendIndex);

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
                this._iOriginalTrendIndex = this._oOriginalTrendParent.indexOfItem(oCard);
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

        onTrendChartRenderComplete: function () {
            var oChart = this.byId("_IDGenVizFrame");
            if (!oChart) { return; }

            setTimeout(function () {
                oChart.$().find("text").each(function () {
                    var $text = jQuery(this);
                    if ($text.text().trim() === "Today") {
                        $text.css({ "font-weight": "bold", "font-size": "13px" });
                    }
                });
            }, 0);
        },

        _getContentAreaWidth: function () {
            var oViewDom = this.getView().getDomRef();
            return oViewDom ? oViewDom.offsetWidth : window.innerWidth * 0.92;
        },

        /* ================= TABLE SELECTION ================= */

        onBulkAction: function () {

            var oTable = this.byId("_IDGenTable3");
            if (!oTable) { return; }

            var aItems = oTable.getItems();

            if (!aItems.length) {
                sap.m.MessageToast.show("No exceptions available.");
                return;
            }

            aItems.forEach(function (oItem) {
                oTable.setSelectedItem(oItem, true);
            });

            this._aSelectedExceptions = aItems.map(function (oItem) {
                return oItem.getBindingContext("openExceptionModel").getObject();
            });
        },

        onStartupRowSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();

            this._aSelectedExceptions = oTable.getSelectedItems().map(function (oItem) {
                return oItem.getBindingContext("openExceptionModel").getObject();
            });
        },

                onStartupRowSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();

            this._aSelectedExceptions = oTable.getSelectedItems().map(function (oItem) {
                return oItem.getBindingContext("openExceptionModel").getObject();
            });
        },

        /* ================= EXPORT ================= */

        _getText: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        _getExportColumns: function () {
            var t = this._getText.bind(this);
            return [
                { label: t("clearingArea"),         property: "ClearingArea",      type: "string" },
                { label: t("excPaymentItemDate"),   property: "PaymentItemDate",   type: "string" },
                { label: t("objectCategory"),       property: "ObjectCategory",    type: "string" },
                { label: t("excPoType"),            property: "po_type",           type: "string" },
                { label: t("excPoTypeStatus"),      property: "po_typet_s",        type: "string" },
                { label: t("piTechnicalStatus"),    property: "Status",            type: "string" },
                { label: t("excPaymentItemNumber"), property: "PaymentItemNumber", type: "string" },
                { label: t("excReference"),         property: "Reference",         type: "string" },
                { label: t("excReasonDetail"),      property: "ReasonDetail",      type: "string" },
                { label: t("excAmount"),            property: "Amount",            type: "number", scale: 2, delimiter: true },
                { label: t("currency"),             property: "CURRENCY",          type: "string" },
                { label: t("excAged"),              property: "Aged",              type: "string" },
                { label: t("excCounterparty"),      property: "CounterParty",      type: "string" }
            ];
        },

        // Selected rows if any, otherwise everything the table currently shows (after filters)
        _getExportRows: function () {
            var oTable = this.byId("_IDGenTable3");
            if (!oTable) { return []; }

            var aItems = oTable.getSelectedItems();
            var aContexts;

            if (aItems.length) {
                aContexts = aItems.map(function (oItem) {
                    return oItem.getBindingContext("openExceptionModel");
                });
            } else {
                var oBinding = oTable.getBinding("items");
                aContexts = oBinding ? oBinding.getCurrentContexts() : [];
            }

            var that = this;
            return aContexts.map(function (oCtx) {
                var o = Object.assign({}, oCtx.getObject());
                o.ObjectCategory = that.formatObjectCategory(o.ObjectCategory);
                o.Amount = parseFloat(String(o.Amount || "").replace(/[^0-9.-]/g, "")) || 0;
                return o;
            });
        },

        onExportExceptions: function () {
            var that = this;
            var aRows = this._getExportRows();

            if (!aRows.length) {
                MessageToast.show(this._getText("noExceptionsToExport"));
                return;
            }

            var oFilterModel = this._getFilterModel();
            var sArea = (oFilterModel && oFilterModel.getProperty("/clearingArea")) || "ALL";
            var sDate = (oFilterModel && this._normalizeDate(oFilterModel.getProperty("/kpiDate"))) || "";

            var oSheet = new Spreadsheet({
                workbook: {
                    columns: this._getExportColumns(),
                    context: { sheetName: this._getText("exportSheetName") }
                },
                dataSource: aRows,
                fileName: "Open_Exceptions_" + sArea + (sDate ? "_" + sDate : "") + ".xlsx",
                worker: false
            });

            oSheet.build()
                .then(function () {
                    MessageToast.show(that._getText("exportSuccess", [aRows.length]));
                })
                .catch(function (oError) {
                    console.error("Export failed:", oError);
                    MessageToast.show(that._getText("exportFailed"));
                })
                .finally(function () {
                    oSheet.destroy();
                });
        }

 

    });
});