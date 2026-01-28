component accessors="true" extends="coldbox.system.web.context.Response" transientCache="false" {

    property name="hasData"       type="boolean";
    property name="hasPagination" type="boolean";

    /**
     * Constructor
     */
    ApiResponseObj function init() {
        variables.hasData       = false;
        variables.hasPagination = false;
        super.init();
        return this;
    }

    /**
     * Wrappers for base Response Object to keep track if have set the data / pagination
     */
    ApiResponseObj function setPagination(
        numeric offset       = 0,
        numeric maxRows      = 0,
        numeric page         = 1,
        numeric totalRecords = 0,
        numeric totalPages   = 1
    ) {
        super.setPagination(argumentCollection = arguments);
        setHasPagination(true);
        return this;
    }

    ApiResponseObj function setData(required any data) {
        super.setData(arguments.data);
        setHasData(true);
        return this;
    }

    ApiResponseObj function setDataWithPagination(
        data,
        resultsKey    = 'results',
        paginationKey = 'pagination'
    ) {
        super.setDataWithPagination(argumentCollection = arguments);
        setHasData(true);
        setHasPagination(true);
        return this;
    }

    /**
     * Modify the response format
     * Only include necessary keys when returning data
     */
    struct function getDataPacket(boolean reset = false) {
        if(arguments.reset) {
            return {};
        }

        var packet = {error: getError() ? true : false};

        if(getMessages().len()) {
            packet.messages = getMessages();
        }

        if(getHasData()) {
            packet.data = getData();
        }

        if(getHasPagination()) {
            packet.pagination = getPagination();
        }

        return packet;
    }

}
