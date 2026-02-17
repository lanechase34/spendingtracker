import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { z } from 'zod';

import CodeBlock from './CodeBlock';

const TagContextSchema = z.object({
    template: z.string(),
    line: z.number(),
    codePrintPlain: z.string(),
});

const ExceptionSchema = z.object({
    exception: z.object({
        type: z.string(),
        Message: z.string(),
        StackTrace: z.string(),
        TagContext: z.array(TagContextSchema).optional(),
    }),
    validationResult: z.array(z.string()).optional(),
});

type TagContext = z.infer<typeof TagContextSchema>;
type ParsedExceptionData = z.infer<typeof ExceptionSchema>;

/**
 * Exception detail modal
 */
export default function ExceptionDetail({ blob }: { blob: string }) {
    const [tab, setTab] = useState<number>(0);

    // Parse and validate the blob using Zod
    let parsedException: ParsedExceptionData | null = null;

    try {
        const rawJson: unknown = JSON.parse(blob);
        const result = ExceptionSchema.safeParse(rawJson);

        if (result.success) {
            parsedException = result.data;
        }
    } catch (_error) {
        parsedException = null;
    }

    if (!parsedException) {
        return <Typography color="text.secondary">Unable to parse exception details.</Typography>;
    }

    return (
        <Card variant="outlined">
            <CardHeader title="Exception Details" subheader={parsedException.exception.type} sx={{ pb: 1 }} />

            <CardContent>
                <Stack spacing={2}>
                    {/* Message */}
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: 500,
                            color: 'text.primary',
                        }}
                    >
                        {parsedException.exception.Message}
                    </Typography>

                    {/* Validation Errors */}
                    {parsedException.validationResult && parsedException.validationResult.length > 0 && (
                        <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="error" gutterBottom>
                                    Validation Errors
                                </Typography>

                                <Stack spacing={0.5}>
                                    {parsedException.validationResult.map((v: string) => (
                                        <Typography key={`validation_row_${v}`} color="error" variant="subtitle2">
                                            - {v}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Box>
                        </>
                    )}

                    <Divider />

                    {/* Tabs */}
                    <Tabs value={tab} onChange={(_, newValue: number) => setTab(newValue)} sx={{ minHeight: 36 }}>
                        <Tab label="Stack Trace" />
                        <Tab label="Code Context" />
                        <Tab label="Raw" />
                    </Tabs>

                    {/* Stack Trace */}
                    {tab === 0 && <CodeBlock value={parsedException.exception.StackTrace} />}

                    {/* Code Context */}
                    {tab === 1 && (
                        <Stack spacing={1}>
                            {parsedException.exception.TagContext?.map((ctx: TagContext) => (
                                <Accordion key={`tag_error_detail_${ctx.line}_${ctx.template}`} variant="outlined">
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="body2">
                                            {ctx.template} — line {ctx.line}
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <CodeBlock value={ctx.codePrintPlain} />
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Stack>
                    )}

                    {/* Raw */}
                    {tab === 2 && <CodeBlock value={JSON.stringify(parsedException, null, 2)} />}
                </Stack>
            </CardContent>
        </Card>
    );
}
