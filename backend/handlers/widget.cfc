component extends="base" secured="User,Admin" {

    this.allowedMethods = {stackedBarChart: 'GET', donutChart: 'GET'};

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

}
