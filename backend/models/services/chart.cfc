component singleton accessors="true" {

    property name="securityService" inject="services.security";

    /**
     * Get stacked bar chart data for ChartJS
     * Stacked by category for each date interval based on start-enddate
     */
    public struct function stackedBarChart(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var dataset     = []; // each category has own struct
        var categoryMap = {}; // map category -> which dataset
        var labels      = [];
        var labelMap    = {}; // map label -> dataset.data position

        // Get all expense data between start->end date
        var expenseData = queryExecute(
            '
            select
                c.name as category, 
                c.color as color,
                e.date,
                e.amount
            from expense e
            inner join category c on e.categoryid = c.id
            where e.userid = :userid
            and e.date >= :start
            and e.date <= :end
            ',
            {
                userid: {value: userid, cfsqltype: 'integer'},
                start : {value: startDate, cfsqltype: 'date'},
                end   : {value: endDate, cfsqltype: 'date'}
            }
        );


        var daysDiff   = dateDiff('d', startDate, endDate) + 1;
        var isWeekView = daysDiff == 7;
        var dateFormat = isWeekView ? 'd' : 'w';

        // Week views are grouped by day
        if(isWeekView) {
            for(var i = 1; i <= daysDiff; i++) {
                var curr = dateFormat(dateAdd(dateFormat, i - 1, startDate), 'short');
                labels.append(curr);
                labelMap[curr] = i;
            }
        }
        // Month and year views are grouped by week
        else {
            var weekDiff      = dateDiff('w', startDate, endDate);
            var startDateWeek = dateFormat(startDate, dateFormat);
            var endDateWeek   = dateFormat(endDate, dateFormat);

            // Account for edge case where startdate might be at start of week and enddate at start of week as well
            var diff = endDateWeek - startDateWeek > weekDiff ? endDateWeek - startDateWeek : weekDiff;

            var firstDayOfStartWeek = getFirstDayOfWeek(startDateWeek, year(startDate));

            for(var i = startDateWeek; i <= startDateWeek + diff; i++) {
                var currStart = dateFormat(dateAdd('ww', i - startDateWeek, firstDayOfStartWeek), 'short');
                var currEnd   = dateFormat(dateAdd('d', -1, dateAdd('ww', 1, currStart)), 'short');

                // Make sure the date range is INCLUSIVE to the current range
                // Edge case for first day
                if(i == startDateWeek && dateCompare(currStart, startDate, 'd') < 0) {
                    currStart = dateFormat(startDate, 'short');
                }
                // Edge case for last day
                if(i == startDateWeek + diff && dateCompare(currEnd, endDate, 'd') > 0) {
                    currEnd = dateFormat(endDate, 'short');
                }

                labels.append('#currStart# - #currEnd#');

                // Map the week to the label range
                labelMap[i] = i - startDateWeek + 1;
            }
        }

        // Each label has its own entry for each category
        expenseData.each((row) => {
            // Get position in dataset.data array
            var identifier = isWeekView ? dateFormat(row.date, 'short') : dateFormat(row.date, dateFormat);

            // Edge case for the '53rd' week of the year, this identifier rolled over to the next year as 1
            if(!isWeekView && month(row.date) == 12 && identifier == 1) {
                identifier = 53;
            }

            var labelIndex = labelMap[identifier];

            // Add category if not added yet
            if(!categoryMap.keyExists(row.category)) {
                dataset.append({
                    label          : row.category,
                    data           : [],
                    backgroundColor: '###row.color#'
                });

                categoryMap[row.category] = dataset.len();
            }

            // Get position of category
            var categoryPosition = categoryMap[row.category];

            // Add the amount
            if(dataset[categoryPosition].data.len() < labelIndex || isNull(dataset[categoryPosition].data[labelIndex])) {
                dataset[categoryPosition].data[labelIndex] = 0;
            }

            dataset[categoryPosition].data[labelIndex] += securityService.decryptValue(row.amount, 'numeric');
        });

        // Convert int cents for output
        dataset.each((categoryData) => {
            categoryData.data = categoryData.data.map((intCents) => {
                return securityService.intToFloat(intCents);
            });
        });

        return {datasets: dataset, labels: labels};
    }

    /**
     * For the given week of the year, get the first day of it
     *
     * @week week 1-52
     * @year year
     */
    private date function getFirstDayOfWeek(required numeric week, required numeric year) {
        var firstDayOfYear = createDate(year, 1, 1);
        var dayOfWeek      = dayOfWeek(firstDayOfYear);

        return dateAdd(
            'd',
            ((week - 1) * 7) - dayOfWeek + 1,
            firstDayOfYear
        );
    }

    /**
     * Get donut chart data for ChartJS
     * Groups data by category and gets total per category
     */
    public struct function donutChart(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var dataset = {
            label          : 'Amount',
            data           : [],
            backgroundColor: []
        };
        var labels      = [];
        var categoryMap = {};

        var expenseData = queryExecute(
            '
            select
                c.name as category, 
                c.color as color,
                e.amount as amount
            from expense e
            inner join category c on e.categoryid = c.id
            where e.userid = :userid
            and e.date >= :start
            and e.date <= :end
            ',
            {
                userid: {value: userid, cfsqltype: 'integer'},
                start : {value: startDate, cfsqltype: 'date'},
                end   : {value: endDate, cfsqltype: 'date'}
            }
        );

        // Each category has a data point in data, backgroundColor array
        // CategoryMap map category -> position in array
        expenseData.each((row) => {
            // Add category if missing
            if(!categoryMap.keyExists(row.category)) {
                labels.append(row.category);
                categoryMap[row.category] = labels.len();

                // Initialize data point to 0
                dataset.data[labels.len()] = 0;

                // Set category color
                dataset.backgroundColor[labels.len()] = '###row.color#'
            }

            // Get array position
            var position = categoryMap[row.category];

            // Add values
            dataset.data[position] += securityService.decryptValue(row.amount, 'numeric');
        });

        // Convert int cents for output
        dataset.data = dataset.data.map((intCents) => {
            return securityService.intToFloat(intCents);
        });

        return {dataset: dataset, labels: labels};
    }

}
