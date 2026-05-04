component extends="base" hint="Widget Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        stackedBarChart: 'GET',
        donutChart     : 'GET',
        lineChart      : 'GET',
        heatMap        : 'GET'
    };

    property name="chartService" inject="services.chart";

    /**
     * Stacked bar chart widget
     *
     * @summary         Stacked Bar Chart
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns spending data grouped by category across the given date range, suitable for rendering a stacked bar chart.
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @response-200    { "description": "Stacked bar chart data." }
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
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @response-200    { "description": "Donut chart data." }
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
     *               startDate must be January 1st of the desired year. The range must be between 1 and 12 months.
     *
     * @summary         Line Chart
     * @tags            Widget
     * @security        ApiKeyAuth
     * @hint            Returns total spending per month across the given date range, suitable for rendering a line chart.
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" }, "description": "Must be January 1st of the desired year." }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be within 1-12 months of startDate." }
     * @response-200    { "description": "Line chart data." }
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
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @response-200    { "description": "Heatmap data." }
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

}
