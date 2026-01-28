<cfoutput>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0;">
        <span>#dateTimeFormat( now(), "mm/dd/yyyy hh:nn tt" )#</span>
        <cfdump var="#args.bugInfo#" top="4"/>
    </body>
</html>
</cfoutput>