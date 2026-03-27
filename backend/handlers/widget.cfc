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
     * @rc.startDate get data in range from start - end
     * @rc.endDate   end
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
     * @rc.startDate get data in range from start - end
     * @rc.endDate   end
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
     * Line chart widget showing total spending per month in start-end range
     *
     * @rc.startDate get data in range from start - end
     * @rc.endDate   end
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
     * Heatmap widget showing number of expenses per day
     *
     * @rc.startDate get data in range from start - end
     * @rc.endDate   end
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
