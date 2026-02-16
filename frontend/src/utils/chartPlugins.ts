import type { Chart, Plugin, LegendElement, LegendItem, ChartEvent, ActiveElement, TooltipItem } from 'chart.js';

/**
 * Utility functions
 */

/**
 * Adds alpha channel to hex color
 */
function addAlphaToColor(color: string, alpha: string): string {
    if (typeof color !== 'string') return color;

    // If color already has alpha, replace it
    if (color.length === 9 && color.startsWith('#')) {
        return color.slice(0, 7) + alpha;
    }

    // If color is hex without alpha, add it
    if (color.length === 7 && color.startsWith('#')) {
        return color + alpha;
    }

    // For other formats (rgba, etc.), return as-is
    return color;
}

/**
 * Removes alpha channel from hex color
 */
function removeAlphaFromColor(color: string): string {
    if (typeof color !== 'string') return color;
    const hasAlpha = color.length === 9 && color.startsWith('#');
    return hasAlpha ? color.slice(0, 7) : color;
}

/**
 * Changes the hightlighted item's cursor to pointer
 */
export const pointerHover = (_event: ChartEvent, activeElements: ActiveElement[], chart: Chart): void => {
    const canvas = chart.canvas;
    canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
};

/**
 * Bar chart
 */
export const barPlugins = {
    /**
     * Tooltip label formatters
     */
    labels: {
        number: (context: TooltipItem<'bar'>): string => {
            const label = context.dataset.label ?? '';
            const value = context.parsed.y!;
            return `${label}: $${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        },
    },

    /**
     * Tooltip footer showing sum
     */
    footer: (tooltipItems: TooltipItem<'bar'>[]): string => {
        // Only one element - no need for footer
        if (tooltipItems.length == 1) return '';

        // Calculate the total of all bars at this x-axis position
        let total = 0;
        tooltipItems.forEach((tooltipItem: TooltipItem<'bar'>): void => {
            total += tooltipItem.parsed.y!;
        });
        return `Total: $${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    },

    /**
     * Tooltip title, show date range for single element
     */
    title: (tooltipItems: TooltipItem<'bar'>[]): string => {
        // More than one element - don't show title
        if (tooltipItems.length > 1) return '';

        // Show the data point label
        return tooltipItems[0].label;
    },

    /**
     * Calculates total sum of bars and adds a label at the top
     */
    totalSumLabel: {
        id: 'totalSumLabel',
        afterDatasetsDraw: (chart: Chart<'bar'>) => {
            const { ctx, data, scales } = chart;
            const xScale = scales.x;
            const yScale = scales.y;

            if (!xScale || !yScale || !data.labels) return;

            // Get the x-axis pixel positions
            const xValues: number[] = data.labels.map((_, index) => xScale.getPixelForValue(index));

            // Get the y pixel positions for each dataset point
            const yValues: number[][] = data.labels.map((_, i) =>
                data.datasets.map((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    const element = meta.data[i];
                    if (!element || meta.hidden || dataset.data[i] == null) {
                        return Number.POSITIVE_INFINITY;
                    }

                    // The element has the visual pixel position
                    return element.getProps(['y'], true).y as number;
                })
            );

            // Draw labels above bars
            data.labels.forEach((_label, index: number) => {
                const yValue = Math.min(...yValues[index]);
                if (!isFinite(yValue)) return;

                const chartValue = yScale.getValueForPixel(yValue);
                if (!chartValue) return;

                const textValue = chartValue.toFixed(0);

                if (chartValue === 0) return;

                ctx.save();

                ctx.imageSmoothingEnabled = false;
                ctx.textRendering = 'geometricPrecision';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                const xPos = Math.round(xValues[index]);
                const yPos = Math.round(yValue - 6);

                ctx.fillText(`$${textValue}`, xPos, yPos);
                ctx.restore();
            });
        },
    } as Plugin<'bar'>,

    /**
     * Handles legend hover to highlight all bar sections for a dataset
     */
    handleHover: (_evt: ChartEvent, item: LegendItem, legend: LegendElement<'bar'>): void => {
        const chart = legend.chart;
        const hoveredDatasetIndex = item.datasetIndex;

        if (hoveredDatasetIndex === undefined) return;

        // Update all datasets' opacity
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);

            if (datasetIndex === hoveredDatasetIndex) {
                // This dataset is hovered - full opacity
                meta.data.forEach((element) => {
                    element.options.backgroundColor = dataset.backgroundColor as string;
                });
            } else {
                // Other datasets - reduce opacity
                const bgColor = dataset.backgroundColor as string;
                const dimmedColor = addAlphaToColor(bgColor, '40'); // 25% opacity
                meta.data.forEach((element) => {
                    element.options.backgroundColor = dimmedColor;
                });
            }
        });

        // Set active tooltip elements for all bars in the hovered dataset
        if (chart.tooltip && typeof chart.tooltip.setActiveElements === 'function') {
            const meta = chart.getDatasetMeta(hoveredDatasetIndex);
            const activeElements = meta.data
                .map((_element, index) => {
                    // Only include bars that have data (not null/undefined/zero)
                    const value = chart.data.datasets[hoveredDatasetIndex].data[index];
                    if (value != null && value !== 0) {
                        return {
                            datasetIndex: hoveredDatasetIndex,
                            index: index,
                        };
                    }
                    return null;
                })
                .filter((el): el is { datasetIndex: number; index: number } => el !== null);

            if (activeElements.length > 0) {
                chart.tooltip.setActiveElements(activeElements, {
                    x: 0,
                    y: 0,
                });
            }
        }

        chart.update('none');
    },

    /**
     * Handles legend leave to reset all bar sections to normal opacity
     */
    handleLeave: (_evt: ChartEvent, _item: LegendItem, legend: LegendElement<'bar'>): void => {
        const chart = legend.chart;

        // Reset all datasets to normal opacity
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((element) => {
                element.options.backgroundColor = dataset.backgroundColor as string;
            });
        });

        // Clear tooltips
        if (chart.tooltip && typeof chart.tooltip.setActiveElements === 'function') {
            chart.tooltip.setActiveElements([], {
                x: 0,
                y: 0,
            });
        }

        chart.update('none');
    },
};

/**
 * Donut chart
 */

/**
 * Get the percentage this value is in a donut chart
 */
const getPercentage = (value: number, context: TooltipItem<'doughnut'>): string => {
    const dataset = context.dataset;
    const total = dataset.data.reduce((sum: number, val): number => {
        const numVal = typeof val === 'number' ? val : 0;
        return sum + numVal;
    }, 0);
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
};

export const donutPlugins = {
    /**
     * Tooltip label formatters
     */
    labels: {
        money: (context: TooltipItem<'doughnut'>): string => {
            const label = context.label ?? '';
            const value = context.parsed;
            const percentage = getPercentage(value, context);
            return `${label}: $${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${percentage}%)`;
        },

        number: (context: TooltipItem<'doughnut'>): string => {
            const label = context.label ?? '';
            const value = context.parsed;
            const percentage = getPercentage(value, context);
            return `${label}: ${value} (${percentage}%)`;
        },

        memory: (context: TooltipItem<'doughnut'>): string => {
            const label = context.label ?? '';
            const value = context.parsed;
            const percentage = getPercentage(value, context);
            return `${label}: ${value}MB (${percentage}%)`;
        },
    },

    /**
     * Pre-configured tooltip options for donut charts
     */
    tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#666',
        borderWidth: 1,
        displayColors: true,
    },

    /**
     * Append '4d' to the colors (alpha channel), except for the hovered index
     */
    handleHover: (_evt: ChartEvent, item: LegendItem, legend: LegendElement<'doughnut'>): void => {
        const chart = legend.chart;
        const dataset = chart.data.datasets?.[0];
        const bgColors = dataset && Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : null;

        if (!bgColors || !Array.isArray(bgColors)) return;

        // Mutate colors safely
        dataset.backgroundColor = bgColors.map((color: string, index) => {
            if (typeof color !== 'string') return color; // skip invalid
            const isHovered = index === item.index;
            return isHovered ? removeAlphaFromColor(color) : addAlphaToColor(color, '2D');
        });

        // Ensure tooltip exists before using
        if (chart.tooltip && typeof chart.tooltip.setActiveElements === 'function' && item.index !== undefined) {
            chart.tooltip.setActiveElements([{ datasetIndex: 0, index: item.index }], {
                x: 0,
                y: 0,
            });
        }

        chart.update();
    },

    /**
     * Removes the alpha channel from background colors
     */
    handleLeave: (_evt: ChartEvent, _item: LegendItem, legend: LegendElement<'doughnut'>): void => {
        const chart = legend.chart;
        const dataset = chart.data.datasets?.[0];
        const bgColors = dataset && Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : null;

        if (!bgColors || !Array.isArray(bgColors)) return;

        // Mutate colors safely
        dataset.backgroundColor = bgColors.map((color: string) => {
            if (typeof color !== 'string') return color; // skip invalid
            return removeAlphaFromColor(color);
        });

        chart.update();
    },
};

export const linePlugins = {
    /**
     * Tooltip label formatters
     */
    labels: {
        money: (context: TooltipItem<'line'>): string => {
            const value = context.parsed.y!;
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        },
    },

    /**
     * Pre-configured tooltip options for line charts
     */
    tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#666',
        borderWidth: 1,
        displayColors: true,
    },
};
