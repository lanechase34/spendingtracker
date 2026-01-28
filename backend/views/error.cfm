<!--- This exception bypassing the RestHandler flow, so this must be done --->
<cfif prc.response.getFormat() EQ 'json'>
    <cfscript>getPageContext().getResponse().setStatus(prc.response.getStatusCode());</cfscript>
    <cfheader name="Content-Type" value="application/json; charset=UTF-8">
    <cfcontent type="application/json" reset="true">
    <cfoutput>#serializeJSON(prc.response.getDataPacket())#</cfoutput>
<cfelse>
    <h4>Server Error. Bug has been filed. Please try again.</h4>
</cfif>