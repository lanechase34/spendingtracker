component extends="base" hint="Widget Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        stackedBarChart: "GET",
        donutChart     : "GET",
        lineChart      : "GET",
        heatMap        : "GET",
        incomeWaterfall: "GET"
    };

    property name="chartService" inject="services.chart";

    /**
     * Stacked bar chart widget
     *
     * @summary         Stacked Bar Chart
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns spending data grouped by category across the given date range, suitable for rendering a stacked bar chart.
     * @param-startDate { "name": "startDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be on or after startDate and at most 365 days after it." }
     * @response-200    ~widget/stackedBarChart/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function stackedBarChart(event, rc, prc) {
        prc.data = chartService.stackedBarChart(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Donut chart widget
     *
     * @summary         Donut Chart
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns spending totals grouped by category across the given date range, suitable for rendering a donut chart.
     * @param-startDate { "name": "startDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be on or after startDate and at most 365 days after it." }
     * @response-200    ~widget/donutChart/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function donutChart(event, rc, prc) {
        prc.data = chartService.donutChart(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Line chart widget
     *
     * @summary         Line Chart
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns total spending per month across the given date range, suitable for rendering a line chart.
     * @param-startDate { "name": "startDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" }, "description": "Must be in January of the desired year." }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be 1-12 months after startDate." }
     * @response-200    ~widget/lineChart/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function lineChart(event, rc, prc) {
        prc.data = chartService.lineChart(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Heatmap widget
     *
     * @summary         Heatmap
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns the number of expenses per day across the given date range, suitable for rendering a heatmap calendar.
     * @param-startDate { "name": "startDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be on or after startDate and at most 365 days after it." }
     * @response-200    ~widget/heatMap/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function heatMap(event, rc, prc) {
        prc.data = chartService.heatMap(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Income waterfall showing net income per month
     *
     * @summary         Income Waterfall
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns the net income per month across the given date range, suitable for rendering a waterfall +/- net income by month.
     * @param-startDate { "name": "startDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be on or after startDate and at most 365 days after it." }
     * @response-200    ~widget/incomeWaterfall/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function incomeWaterfall(event, rc, prc) {
        prc.data = chartService.waterfallChart(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

}
