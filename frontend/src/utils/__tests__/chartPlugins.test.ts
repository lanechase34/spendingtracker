import type { ActiveElement, Chart, ChartEvent, LegendElement, LegendItem, TooltipItem } from 'chart.js';
import { barPlugins, donutPlugins, linePlugins, pointerHover } from 'utils/chartPlugins';

/**
 * Chart.js objects are large, so tests build only the fields each plugin reads
 */
const event = {} as ChartEvent;

const barItem = (y: number | null, label = 'Jan', datasetLabel?: string) =>
    ({ parsed: { y }, label, dataset: { label: datasetLabel } }) as unknown as TooltipItem<'bar'>;

const donutItem = (value: number, data: unknown[], label = 'Food') =>
    ({ parsed: value, label, dataset: { data } }) as unknown as TooltipItem<'doughnut'>;

interface FakeElement {
    options: Record<string, unknown>;
}

function fakeChart(datasets: { backgroundColor: unknown; data: unknown[] }[], withTooltip = true) {
    const metas = datasets.map((dataset) => ({
        data: dataset.data.map((): FakeElement => ({ options: {} })),
    }));
    const tooltip = { setActiveElements: jest.fn() };
    const chart = {
        data: { datasets },
        getDatasetMeta: (index: number) => metas[index],
        tooltip: withTooltip ? tooltip : undefined,
        update: jest.fn(),
    };
    return { chart, metas, tooltip };
}

const legendFor = (chart: unknown) => ({ chart }) as unknown as LegendElement<'bar'> & LegendElement<'doughnut'>;

describe('pointerHover', () => {
    it('Should set the cursor to pointer only while hovering an element', () => {
        const chart = { canvas: { style: { cursor: '' } } } as unknown as Chart;

        pointerHover(event, [{} as ActiveElement], chart);
        expect(chart.canvas.style.cursor).toBe('pointer');

        pointerHover(event, [], chart);
        expect(chart.canvas.style.cursor).toBe('default');
    });
});

describe('barPlugins', () => {
    describe('labels.number', () => {
        it('Should format the dataset label and value as money', () => {
            expect(barPlugins.labels.number(barItem(1234.567, 'Jan', 'Food'))).toBe('Food: $1,234.57');
        });

        it('Should put the minus sign before the dollar sign', () => {
            expect(barPlugins.labels.number(barItem(-42.5, 'Jan', 'Refund'))).toBe('Refund: -$42.5');
        });

        it('Should treat a null value as 0 and a missing label as empty', () => {
            expect(barPlugins.labels.number(barItem(null))).toBe(': $0');
        });
    });

    describe('footer', () => {
        it('Should be empty for a single item', () => {
            expect(barPlugins.footer([barItem(10)])).toBe('');
        });

        it('Should total every item and skip null values', () => {
            expect(barPlugins.footer([barItem(10.5), barItem(null), barItem(1000)])).toBe('Total: $1,010.5');
        });

        it('Should show a negative total with the sign first', () => {
            expect(barPlugins.footer([barItem(10), barItem(-60)])).toBe('Total: -$50');
        });
    });

    describe('title', () => {
        it('Should show the label for a single item', () => {
            expect(barPlugins.title([barItem(1, 'Week 3')])).toBe('Week 3');
        });

        it('Should be empty for multiple items or no items', () => {
            expect(barPlugins.title([barItem(1), barItem(2)])).toBe('');
            expect(barPlugins.title([])).toBe('');
        });
    });

    describe('handleHover', () => {
        it('Should dim every other dataset and keep the hovered one at full opacity', () => {
            const { chart, metas } = fakeChart([
                { backgroundColor: '#ff0000', data: [1, 2] },
                { backgroundColor: '#00ff00', data: [3, 4] },
            ]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(metas[0]?.data.map((e) => e.options['backgroundColor'])).toEqual(['#ff0000', '#ff0000']);
            expect(metas[1]?.data.map((e) => e.options['backgroundColor'])).toEqual(['#00ff0040', '#00ff0040']);
            expect(chart.update).toHaveBeenCalledWith('none');
        });

        it('Should replace an existing alpha channel when dimming', () => {
            const { chart, metas } = fakeChart([
                { backgroundColor: '#ff0000', data: [1] },
                { backgroundColor: '#00ff00cc', data: [1] },
            ]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(metas[1]?.data[0]?.options['backgroundColor']).toBe('#00ff0040');
        });

        it('Should leave non-hex colors unchanged when dimming', () => {
            const { chart, metas } = fakeChart([
                { backgroundColor: '#ff0000', data: [1] },
                { backgroundColor: 'rgba(0,0,0,1)', data: [1] },
            ]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(metas[1]?.data[0]?.options['backgroundColor']).toBe('rgba(0,0,0,1)');
        });

        it('Should skip datasets whose color is not a single string', () => {
            const { chart, metas } = fakeChart([
                { backgroundColor: '#ff0000', data: [1] },
                { backgroundColor: ['#00ff00'], data: [1] },
            ]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(metas[1]?.data[0]?.options['backgroundColor']).toBeUndefined();
        });

        it('Should show tooltips only for bars that have a non-zero value', () => {
            const { chart, tooltip } = fakeChart([{ backgroundColor: '#ff0000', data: [5, 0, null, 7] }]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(tooltip.setActiveElements).toHaveBeenCalledWith(
                [
                    { datasetIndex: 0, index: 0 },
                    { datasetIndex: 0, index: 3 },
                ],
                { x: 0, y: 0 }
            );
        });

        it('Should not set tooltips when the hovered dataset has no values', () => {
            const { chart, tooltip } = fakeChart([{ backgroundColor: '#ff0000', data: [0, null] }]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(tooltip.setActiveElements).not.toHaveBeenCalled();
        });

        it('Should still update when the chart has no tooltip', () => {
            const { chart } = fakeChart([{ backgroundColor: '#ff0000', data: [1] }], false);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));

            expect(chart.update).toHaveBeenCalledWith('none');
        });

        it('Should do nothing when the legend item has no dataset index', () => {
            const { chart } = fakeChart([{ backgroundColor: '#ff0000', data: [1] }]);

            barPlugins.handleHover(event, {} as LegendItem, legendFor(chart));

            expect(chart.update).not.toHaveBeenCalled();
        });
    });

    describe('handleLeave', () => {
        it('Should restore every dataset color and clear tooltips', () => {
            const { chart, metas, tooltip } = fakeChart([
                { backgroundColor: '#ff0000', data: [1] },
                { backgroundColor: '#00ff00', data: [1] },
            ]);

            barPlugins.handleHover(event, { datasetIndex: 0 } as LegendItem, legendFor(chart));
            barPlugins.handleLeave(event, {} as LegendItem, legendFor(chart));

            expect(metas[1]?.data[0]?.options['backgroundColor']).toBe('#00ff00');
            expect(tooltip.setActiveElements).toHaveBeenLastCalledWith([], { x: 0, y: 0 });
        });
    });

    describe('totalSumLabel', () => {
        // Called as a method so chart.js keeps its `this` binding
        const draw = (chart: unknown) => {
            barPlugins.totalSumLabel.afterDatasetsDraw?.(chart as Chart<'bar'>, {}, {}, undefined as never);
        };

        function barChart(yPixels: (number | undefined)[][], options: { hidden?: boolean[] } = {}) {
            const ctx = { save: jest.fn(), restore: jest.fn(), fillText: jest.fn() };
            const labels = yPixels[0]?.map((_, i) => `L${String(i)}`) ?? [];
            const chart = {
                ctx,
                data: {
                    labels,
                    datasets: yPixels.map((row) => ({ data: row.map((y) => (y === undefined ? null : 1)) })),
                },
                scales: {
                    x: { getPixelForValue: (index: number) => index * 100 + 50.4 },
                    // 1 pixel per dollar measured from a 500px baseline
                    y: { getValueForPixel: (pixel: number) => 500 - pixel },
                },
                getDatasetMeta: (datasetIndex: number) => ({
                    hidden: options.hidden?.[datasetIndex] ?? false,
                    data: (yPixels[datasetIndex] ?? []).map((y) => ({ getProps: () => ({ y }) })),
                }),
            };
            return { chart, ctx };
        }

        it('Should draw the total above the tallest stack in each column', () => {
            // Column 0 tops out at pixel 300 ($200), column 1 at pixel 400 ($100)
            const { chart, ctx } = barChart([
                [450, 400],
                [300, 450],
            ]);

            draw(chart);

            expect(ctx.fillText).toHaveBeenCalledWith('$200', 50, 294);
            expect(ctx.fillText).toHaveBeenCalledWith('$100', 150, 394);
        });

        it('Should ignore hidden datasets and missing values', () => {
            const { chart, ctx } = barChart(
                [
                    [450, undefined],
                    [100, undefined],
                ],
                { hidden: [false, true] }
            );

            draw(chart);

            expect(ctx.fillText).toHaveBeenCalledTimes(1);
            expect(ctx.fillText).toHaveBeenCalledWith('$50', 50, 444);
        });

        it('Should round totals to whole dollars with thousands separators', () => {
            // A 1,500px tall stack measured from the 500px baseline
            const { chart, ctx } = barChart([[-1000.4]]);

            draw(chart);

            expect(ctx.fillText).toHaveBeenCalledWith('$1,500', 50, -1006);
        });

        it('Should skip columns that total zero', () => {
            const { chart, ctx } = barChart([[500]]);

            draw(chart);

            expect(ctx.fillText).not.toHaveBeenCalled();
        });

        it('Should do nothing without scales or labels', () => {
            const { chart, ctx } = barChart([[300]]);

            draw({ ...chart, scales: {} });
            draw({ ...chart, data: { ...chart.data, labels: undefined } });

            expect(ctx.fillText).not.toHaveBeenCalled();
        });
    });
});

describe('donutPlugins', () => {
    describe('labels', () => {
        it('Should format money with the percentage of the total', () => {
            expect(donutPlugins.labels.money(donutItem(25, [25, 75]))).toBe('Food: $25 (25.0%)');
            expect(donutPlugins.labels.money(donutItem(1234.5, [1234.5]))).toBe('Food: $1,234.5 (100.0%)');
        });

        it('Should format plain numbers and memory', () => {
            expect(donutPlugins.labels.number(donutItem(1, [1, 2]))).toBe('Food: 1 (33.3%)');
            expect(donutPlugins.labels.memory(donutItem(512, [512, 512], 'Heap'))).toBe('Heap: 512MB (50.0%)');
        });

        it('Should ignore non-numeric data when totalling', () => {
            expect(donutPlugins.labels.number(donutItem(10, [10, null, 'x', 10]))).toBe('Food: 10 (50.0%)');
        });

        it('Should show 0.0% when the total is zero', () => {
            expect(donutPlugins.labels.number(donutItem(0, [0, 0]))).toBe('Food: 0 (0.0%)');
        });
    });

    describe('handleHover / handleLeave', () => {
        it('Should dim every slice except the hovered one, then restore them', () => {
            const { chart, tooltip } = fakeChart([{ backgroundColor: ['#111111', '#22222280', '#333333'], data: [] }]);

            donutPlugins.handleHover(event, { index: 1 } as LegendItem, legendFor(chart));

            expect(chart.data.datasets[0]?.backgroundColor).toEqual(['#1111112D', '#222222', '#3333332D']);
            expect(tooltip.setActiveElements).toHaveBeenCalledWith([{ datasetIndex: 0, index: 1 }], { x: 0, y: 0 });

            donutPlugins.handleLeave(event, {} as LegendItem, legendFor(chart));

            expect(chart.data.datasets[0]?.backgroundColor).toEqual(['#111111', '#222222', '#333333']);
            expect(chart.update).toHaveBeenCalledTimes(2);
        });

        it('Should not set a tooltip when the legend item has no index', () => {
            const { chart, tooltip } = fakeChart([{ backgroundColor: ['#111111'], data: [] }]);

            donutPlugins.handleHover(event, {} as LegendItem, legendFor(chart));

            expect(tooltip.setActiveElements).not.toHaveBeenCalled();
            expect(chart.update).toHaveBeenCalled();
        });

        it.each([
            ['a single color string', '#111111'],
            ['a non-string color', ['#111111', { gradient: true }]],
        ])('Should leave colors alone for %s', (_label, backgroundColor) => {
            const { chart } = fakeChart([{ backgroundColor, data: [] }]);

            donutPlugins.handleHover(event, { index: 0 } as LegendItem, legendFor(chart));
            donutPlugins.handleLeave(event, {} as LegendItem, legendFor(chart));

            expect(chart.data.datasets[0]?.backgroundColor).toEqual(backgroundColor);
            expect(chart.update).not.toHaveBeenCalled();
        });

        it('Should do nothing when the chart has no datasets', () => {
            const { chart } = fakeChart([]);

            donutPlugins.handleHover(event, { index: 0 } as LegendItem, legendFor(chart));

            expect(chart.update).not.toHaveBeenCalled();
        });
    });
});

describe('linePlugins', () => {
    it('Should format the value as money and treat null as 0', () => {
        const item = (y: number | null) => ({ parsed: { y } }) as unknown as TooltipItem<'line'>;

        expect(linePlugins.labels.money(item(9876.543))).toBe('$9,876.54');
        expect(linePlugins.labels.money(item(null))).toBe('$0');
        expect(linePlugins.labels.money(item(-15.25))).toBe('-$15.25');
    });
});
