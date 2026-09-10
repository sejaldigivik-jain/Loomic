"use client";

import {
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Download,
    Eye,
    Film,
    Gauge,
    Hash,
    Heart,
    Maximize2,
    Megaphone,
    Pencil,
    RotateCcw,
    UserPlus,
    Users,
} from "lucide-react";

import {
    Card,
    CardContent,
} from "@/components/ui/card";

import {
    Button,
} from "@/components/ui/button";

import {
    Badge,
} from "@/components/ui/badge";

import {
    authenticatedFetch,
} from "@/lib/store";

import {
    formatCompact,
    formatNumber,
} from "@/lib/utils";

type ReportProps = {
    summary: any;
    clientName: string;
    queryString: string;
    storageKey: string;
};

type EditMap = Record<string, string>;

type ReportMetric = {
    value: number | null;
    label: string;
    source: string;
    comparison?: number | null;
};

function safeNumber(value: unknown) {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
}

function dateInputValue(date: Date) {
    return date.toISOString().slice(0, 10);
}

function displayReportDate(value: string) {
    if (!value) return "";

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function splitDateRange(
    from: string,
    to: string,
) {
    const start = new Date(
        `${from}T00:00:00.000Z`,
    );

    const end = new Date(
        `${to}T00:00:00.000Z`,
    );

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return null;
    }

    const totalDays =
        Math.floor(
            (end.getTime() - start.getTime()) /
            86400000,
        ) + 1;

    if (totalDays < 2) {
        return null;
    }

    const firstPeriodDays =
        Math.floor(totalDays / 2);

    const periodATo = new Date(
        start.getTime() +
        (firstPeriodDays - 1) *
        86400000,
    );

    const periodBFrom = new Date(
        periodATo.getTime() +
        86400000,
    );

    return {
        aFrom: dateInputValue(start),
        aTo: dateInputValue(periodATo),
        bFrom: dateInputValue(periodBFrom),
        bTo: dateInputValue(end),
    };
}

function comparisonChange(
    first: number,
    second: number,
) {
    if (first === 0) {
        return second === 0
            ? 0
            : null;
    }

    return Number(
        (
            ((second - first) /
                Math.abs(first)) *
            100
        ).toFixed(1),
    );
}

function comparisonMediaTotals(
    data: any,
) {
    const rows =
        data?.content ?? [];

    return rows.reduce(
        (
            total: {
                reach: number;
                views: number;
                interactions: number;
                shares: number;
                saves: number;
                content: number;
            },
            item: any,
        ) => {
            const likes =
                safeNumber(item.likes);

            const comments =
                safeNumber(item.comments);

            const shares =
                safeNumber(item.shares);

            const saves =
                safeNumber(item.saves);

            const interactions =
                safeNumber(
                    item.totalInteractions,
                ) ||
                likes +
                comments +
                shares +
                saves;

            total.reach +=
                safeNumber(item.reach);

            total.views +=
                safeNumber(item.views);

            total.interactions +=
                interactions;

            total.shares += shares;
            total.saves += saves;
            total.content += 1;

            return total;
        },
        {
            reach: 0,
            views: 0,
            interactions: 0,
            shares: 0,
            saves: 0,
            content: 0,
        },
    );
}

function metric(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "Not available";
    }

    return formatCompact(value);
}

function numberMetric(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "Not available";
    }

    return formatNumber(value);
}

function percentage(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "Not available";
    }

    return `${value}%`;
}

function comparisonText(
    value: number | null | undefined,
) {
    if (value === null || value === undefined) {
        return "Previous-period comparison unavailable";
    }

    return `${value >= 0 ? "+" : ""}${value}% vs previous period`;
}

function deltaSentence(
    title: string,
    value: number | null | undefined,
) {
    if (value === null || value === undefined) {
        return `${title} does not have a reliable previous-period comparison for this reporting period.`;
    }

    if (value > 0) {
        return `${title} increased by ${Math.abs(
            value,
        )}% compared with the previous equal-length period.`;
    }

    if (value < 0) {
        return `${title} decreased by ${Math.abs(
            value,
        )}% compared with the previous equal-length period.`;
    }

    return `${title} remained unchanged compared with the previous equal-length period.`;
}

function EditableText({
    id,
    fallback,
    editing,
    edits,
    setEdit,
    className = "",
}: {
    id: string;
    fallback: string;
    editing: boolean;
    edits: EditMap;
    setEdit: (id: string, value: string) => void;
    className?: string;
}) {
    const value = edits[id] ?? fallback;

    return (
        <div
            className={`${className} ${editing
                ? "rounded-md outline outline-1 outline-dashed outline-primary/50"
                : ""
                }`}
            contentEditable={editing}
            suppressContentEditableWarning
            onBlur={(event) => {
                if (!editing) return;

                setEdit(
                    id,
                    event.currentTarget.innerText.trim(),
                );
            }}
        >
            {value}
        </div>
    );
}

function Notes({
    prefix,
    wins,
    improve,
    recommendations,
    editing,
    edits,
    setEdit,
}: {
    prefix: string;
    wins: string[];
    improve: string[];
    recommendations: string[];
    editing: boolean;
    edits: EditMap;
    setEdit: (id: string, value: string) => void;
}) {
    const sections = [
        {
            title: "Key Wins",
            key: "wins",
            items: wins,
        },
        {
            title: "Points to Improve",
            key: "improve",
            items: improve,
        },
        {
            title: "Recommendations",
            key: "recommendations",
            items: recommendations,
        },
    ];

    return (
        <div className="grid gap-5 lg:grid-cols-3">
            {sections.map((section) => (
                <div key={section.key}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                        {section.title}
                    </h3>

                    <div className="space-y-2">
                        {section.items.map((item, index) => (
                            <div
                                key={`${section.key}-${index}`}
                                className="flex gap-2 text-sm leading-6 text-muted-foreground"
                            >
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                                <EditableText
                                    id={`${prefix}.${section.key}.${index}`}
                                    fallback={item}
                                    editing={editing}
                                    edits={edits}
                                    setEdit={setEdit}
                                    className="min-w-0 flex-1"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Slide({
    title,
    eyebrow,
    children,
    editing,
    edits,
    setEdit,
    slideId,
    printMode = false,
    pageNumber,
    totalPages,
    footerLeft,
}: {
    title: string;
    eyebrow?: string;
    children: ReactNode;
    editing: boolean;
    edits: EditMap;
    setEdit: (id: string, value: string) => void;
    slideId: string;
    printMode?: boolean;
    pageNumber?: number;
    totalPages?: number;
    footerLeft?: string;
}) {
    return (
        <section
            className={`flex flex-col overflow-hidden border border-border bg-card ${printMode
                ? "sf-report-page"
                : "min-h-[620px] rounded-2xl shadow-sm lg:aspect-video lg:min-h-0"
                }`}
        >
            <div className="border-b border-border px-7 py-5 lg:px-10">
                {eyebrow && (
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                        {eyebrow}
                    </p>
                )}

                <EditableText
                    id={`${slideId}.title`}
                    fallback={title}
                    editing={editing && !printMode}
                    edits={edits}
                    setEdit={setEdit}
                    className="font-display text-2xl font-semibold tracking-tight lg:text-3xl"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-7 lg:p-10">
                {children}
            </div>

            {printMode && (
                <div className="sf-report-footer flex items-center justify-between border-t border-border px-10 py-3 text-[10px] text-muted-foreground">
                    <span>{footerLeft}</span>

                    <span>
                        {pageNumber} / {totalPages}
                    </span>
                </div>
            )}
        </section>
    );
}

function Unavailable({
    title,
    reason,
}: {
    title: string;
    reason: string;
}) {
    return (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground" />

            <p className="font-semibold">
                {title}
            </p>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {reason}
            </p>
        </div>
    );
}

function ProgressRows({
    rows,
}: {
    rows: Array<{
        label: string;
        value: number;
    }>;
}) {
    const max = Math.max(
        1,
        ...rows.map((row) => row.value),
    );

    return (
        <div className="space-y-3">
            {rows.slice(0, 8).map((row) => (
                <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between gap-4 text-xs">
                        <span className="truncate font-medium">
                            {row.label}
                        </span>

                        <span className="text-muted-foreground">
                            {formatNumber(row.value)}
                        </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{
                                width: `${Math.max(
                                    3,
                                    (row.value / max) * 100,
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

const STOP_WORDS = new Set([
    "this",
    "that",
    "with",
    "from",
    "your",
    "have",
    "will",
    "more",
    "just",
    "into",
    "when",
    "where",
    "what",
    "about",
    "here",
    "there",
    "their",
    "they",
    "them",
    "been",
    "being",
    "were",
    "make",
    "made",
    "come",
    "join",
    "only",
    "than",
    "then",
    "instagram",
    "reels",
    "reel",
    "post",
    "follow",
    "today",
    "tomorrow",
]);

function rankCaptionTerms(
    content: any[],
    hashtagsOnly: boolean,
) {
    const map = new Map<
        string,
        {
            name: string;
            posts: number;
            reach: number;
            interactions: number;
        }
    >();

    for (const item of content) {
        const caption = String(item.caption ?? "");

        const tokens = hashtagsOnly
            ? caption.match(/#[\p{L}\p{N}_]+/gu) ?? []
            : caption
                .toLowerCase()
                .match(/[\p{L}\p{N}]{4,}/gu) ?? [];

        const unique = Array.from(
            new Set(
                tokens
                    .map((token) =>
                        token
                            .toLowerCase()
                            .replace(
                                /[^\p{L}\p{N}_#]/gu,
                                "",
                            ),
                    )
                    .filter(
                        (token) =>
                            token &&
                            (hashtagsOnly ||
                                (!STOP_WORDS.has(token) &&
                                    token.length >= 4)),
                    ),
            ),
        );

        for (const token of unique) {
            const bucket = map.get(token) ?? {
                name: token,
                posts: 0,
                reach: 0,
                interactions: 0,
            };

            bucket.posts += 1;
            bucket.reach += safeNumber(item.reach);

            bucket.interactions +=
                safeNumber(item.totalInteractions) ||
                safeNumber(item.likes) +
                safeNumber(item.comments) +
                safeNumber(item.shares) +
                safeNumber(item.saves);

            map.set(token, bucket);
        }
    }

    return Array.from(map.values())
        .map((item) => {
            const avgReach = item.posts
                ? Math.round(item.reach / item.posts)
                : 0;

            const avgInteractions = item.posts
                ? Number(
                    (
                        item.interactions / item.posts
                    ).toFixed(1),
                )
                : 0;

            return {
                ...item,
                avgReach,
                avgInteractions,
                score:
                    avgReach +
                    avgInteractions * 5,
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
}

function ComparisonGraph({
    rows,
    periodALabel,
    periodBLabel,
}: {
    rows: Array<{
        label: string;
        a: number;
        b: number;
    }>;
    periodALabel: string;
    periodBLabel: string;
}) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-[11px]">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-full bg-primary" />

                    <span>
                        Period A · {periodALabel}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-full bg-violet-500" />

                    <span>
                        Period B · {periodBLabel}
                    </span>
                </div>
            </div>

            {rows.map((row) => {
                const max = Math.max(
                    row.a,
                    row.b,
                    1,
                );

                const widthA =
                    Math.max(
                        row.a > 0 ? 2 : 0,
                        (row.a / max) * 100,
                    );

                const widthB =
                    Math.max(
                        row.b > 0 ? 2 : 0,
                        (row.b / max) * 100,
                    );

                return (
                    <div
                        key={row.label}
                        className="space-y-1"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {row.label}
                        </p>

                        <div className="grid grid-cols-[62px_1fr_55px] items-center gap-2 text-[10px]">
                            <span>
                                Period A
                            </span>

                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-primary"
                                    style={{
                                        width: `${widthA}%`,
                                    }}
                                />
                            </div>

                            <span className="text-right font-semibold">
                                {formatCompact(row.a)}
                            </span>
                        </div>

                        <div className="grid grid-cols-[62px_1fr_55px] items-center gap-2 text-[10px]">
                            <span>
                                Period B
                            </span>

                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-violet-500"
                                    style={{
                                        width: `${widthB}%`,
                                    }}
                                />
                            </div>

                            <span className="text-right font-semibold">
                                {formatCompact(row.b)}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function InsightsReport({
    summary,
    clientName,
    queryString,
    storageKey,
}: ReportProps) {
    const [slide, setSlide] =
        useState(0);

    const [editing, setEditing] =
        useState(false);

    const [edits, setEdits] =
        useState<EditMap>({});

    const [extras, setExtras] =
        useState<any>(null);

    const [
        extrasLoading,
        setExtrasLoading,
    ] = useState(false);

    const [
        compareOpen,
        setCompareOpen,
    ] = useState(false);

    const [
        compareFromA,
        setCompareFromA,
    ] = useState("");

    const [
        compareToA,
        setCompareToA,
    ] = useState("");

    const [
        compareFromB,
        setCompareFromB,
    ] = useState("");

    const [
        compareToB,
        setCompareToB,
    ] = useState("");

    const [
        comparisonA,
        setComparisonA,
    ] = useState<any>(null);

    const [
        comparisonB,
        setComparisonB,
    ] = useState<any>(null);

    const [
        comparisonLoading,
        setComparisonLoading,
    ] = useState(false);

    const [
        comparisonError,
        setComparisonError,
    ] = useState("");

    const slides = [
        "Cover",
        "Overview",
        "Reach",
        "Views",
        "Interactions",
        "Demographics",
        "Followers",
        "Posting Time",
        "Skip Rate",
        "Follower / Non-Follower",
        "Profile Visits",
        "Top Performing Content",
        "Hashtags / Keywords",
        "Ad Reach",
        "Date Comparison",
        "Thank You",
    ];

    const localStorageKey =
        useMemo(
            () =>
                `socialflow:insights-report:${storageKey}`,
            [storageKey],
        );

    useEffect(() => {
        try {
            const stored =
                window.localStorage.getItem(
                    localStorageKey,
                );

            setEdits(
                stored
                    ? (JSON.parse(stored) as EditMap)
                    : {},
            );
        } catch {
            setEdits({});
        }
    }, [localStorageKey]);

    function setEdit(
        id: string,
        value: string,
    ) {
        const next = {
            ...edits,
            [id]: value,
        };

        setEdits(next);

        try {
            window.localStorage.setItem(
                localStorageKey,
                JSON.stringify(next),
            );
        } catch {
            // Local storage may be unavailable.
        }
    }

    function resetEdits() {
        setEdits({});

        try {
            window.localStorage.removeItem(
                localStorageKey,
            );
        } catch {
            // Ignore.
        }
    }

    useEffect(() => {
        if (!queryString) {
            setExtras(null);
            return;
        }

        const controller =
            new AbortController();

        setExtrasLoading(true);

        authenticatedFetch(
            `/api/v1/analytics/report?${queryString}`,
            {
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                const json =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        json.error?.message ??
                        "Could not load report data",
                    );
                }

                setExtras(json.data);
            })
            .catch((error) => {
                if (error?.name !== "AbortError") {
                    console.error(
                        "[InsightsReport]",
                        error,
                    );
                }
            })
            .finally(() => {
                setExtrasLoading(false);
            });

        return () =>
            controller.abort();
    }, [queryString]);

    useEffect(() => {
        if (
            !summary?.from ||
            !summary?.to
        ) {
            return;
        }

        const split =
            splitDateRange(
                summary.from,
                summary.to,
            );

        if (!split) {
            return;
        }

        setCompareFromA(
            split.aFrom,
        );

        setCompareToA(
            split.aTo,
        );

        setCompareFromB(
            split.bFrom,
        );

        setCompareToB(
            split.bTo,
        );

        setComparisonA(null);
        setComparisonB(null);
        setComparisonError("");
    }, [
        summary?.from,
        summary?.to,
    ]);

    const totals =
        summary?.totals ?? {};

    const comparisons =
        summary?.comparisons ?? {};

    const series =
        summary?.series ?? [];

    const content =
        summary?.content ?? [];

    const intelligence =
        summary?.intelligence ?? {};

    const meta =
        summary?.meta ?? {};

    const dateRange =
        summary?.from && summary?.to
            ? `${summary.from} – ${summary.to}`
            : "Selected reporting period";

    /*
     * IMPORTANT ACCURACY RULE
     *
     * Account-level historical Meta Insights may be unavailable
     * outside Meta's retention window.
     *
     * Individual media insights can still exist.
     */
    const hasAccountSnapshots =
        Array.isArray(series) &&
        series.length > 0;

    const hasAccountReach =
        safeNumber(totals.reach) > 0 ||
        series.some(
            (row: any) =>
                safeNumber(row?.reach) > 0,
        );

    const hasAccountViews =
        safeNumber(totals.views) > 0 ||
        series.some(
            (row: any) =>
                safeNumber(row?.views) > 0,
        );

    const hasAccountInteractions =
        safeNumber(totals.engagement) > 0 ||
        series.some(
            (row: any) =>
                safeNumber(row?.engagement) > 0,
        );

    const hasAccountProfileViews =
        safeNumber(totals.profileViews) > 0 ||
        series.some(
            (row: any) =>
                safeNumber(row?.profileViews) > 0,
        );

    const historicalRange =
        Boolean(meta?.customRangeNote);

    /*
     * Real totals calculated from the actual media rows shown
     * in Content Analytics.
     */
    const mediaTotals = useMemo(() => {
        return content.reduce(
            (
                total: {
                    reach: number;
                    views: number;
                    likes: number;
                    comments: number;
                    shares: number;
                    saves: number;
                    interactions: number;
                },
                item: any,
            ) => {
                const likes =
                    safeNumber(item.likes);

                const comments =
                    safeNumber(item.comments);

                const shares =
                    safeNumber(item.shares);

                const saves =
                    safeNumber(item.saves);

                const interactions =
                    safeNumber(
                        item.totalInteractions,
                    ) ||
                    likes +
                    comments +
                    shares +
                    saves;

                total.reach +=
                    safeNumber(item.reach);

                total.views +=
                    safeNumber(item.views);

                total.likes += likes;
                total.comments += comments;
                total.shares += shares;
                total.saves += saves;
                total.interactions +=
                    interactions;

                return total;
            },
            {
                reach: 0,
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                saves: 0,
                interactions: 0,
            },
        );
    }, [content]);

    /*
     * When account snapshots exist, use account metrics.
     * Otherwise use clearly-labelled content totals.
     *
     * We never pretend summed media reach is account Reach.
     */
    const reachMetric: ReportMetric =
        hasAccountReach
            ? {
                value: safeNumber(
                    totals.reach,
                ),
                label: "Account Reach",
                source:
                    "Meta account-level Instagram Insights",
                comparison:
                    comparisons.reach,
            }
            : content.length
                ? {
                    value:
                        mediaTotals.reach,
                    label:
                        "Content Reach",
                    source:
                        "Sum of real media-level Reach for content published in this period",
                    comparison:
                        comparisons.contentReach ??
                        null,
                }
                : {
                    value: null,
                    label:
                        "Account Reach",
                    source:
                        "Historical account-level Reach unavailable",
                    comparison: null,
                };

    const viewsMetric: ReportMetric =
        hasAccountViews
            ? {
                value: safeNumber(
                    totals.views,
                ),
                label: "Views",
                source:
                    "Meta account-level Instagram Insights",
                comparison:
                    comparisons.views,
            }
            : content.length
                ? {
                    value:
                        mediaTotals.views,
                    label:
                        "Content Views",
                    source:
                        "Sum of real media-level Views for content published in this period",
                    comparison: null,
                }
                : {
                    value: null,
                    label: "Views",
                    source:
                        "Account-level Views unavailable",
                    comparison: null,
                };

    const interactionsMetric: ReportMetric =
        hasAccountInteractions
            ? {
                value: safeNumber(
                    totals.engagement,
                ),

                label:
                    "Interactions",

                source:
                    "Meta account-level Instagram Insights",

                comparison:
                    comparisons.engagement,
            }
            : content.length
                ? {
                    value:
                        mediaTotals.interactions,

                    label:
                        "Content Interactions",

                    source:
                        "Likes + comments + shares + saves from real media insights",

                    comparison: null,
                }
                : {
                    value: null,

                    label:
                        "Interactions",

                    source:
                        "Account-level interactions unavailable",

                    comparison: null,
                };

    const profileVisitsAvailable =
        hasAccountProfileViews;

    /*
     * Current followers are always the latest connected account total.
     * Do not label that value as historical.
     */
    const currentFollowers =
        safeNumber(totals.followers);

    const historicalFollowerGrowthAvailable =
        !historicalRange ||
        hasAccountSnapshots;

    const hashtags = useMemo(
        () =>
            rankCaptionTerms(
                content,
                true,
            ),
        [content],
    );

    const keywords = useMemo(
        () =>
            rankCaptionTerms(
                content,
                false,
            ),
        [content],
    );

    const topContent =
        [...content]
            .sort(
                (a: any, b: any) =>
                    safeNumber(b.reach) -
                    safeNumber(a.reach),
            )
            .slice(0, 3);

    const topReachContent =
        topContent[0];

    const comparisonReady =
        Boolean(
            comparisonA &&
            comparisonB,
        );

    const comparisonMediaA =
        useMemo(
            () =>
                comparisonA
                    ? comparisonMediaTotals(
                        comparisonA,
                    )
                    : null,
            [comparisonA],
        );

    const comparisonMediaB =
        useMemo(
            () =>
                comparisonB
                    ? comparisonMediaTotals(
                        comparisonB,
                    )
                    : null,
            [comparisonB],
        );

    /*
     * IMPORTANT:
     * Decide availability PER METRIC.
     *
     * Reach can be available at account level while Views or
     * Interactions are unavailable.
     *
     * Do not use one "has account data" flag for everything.
     */
    const comparisonHasAccountReach =
        Boolean(
            comparisonA &&
            comparisonB &&
            (
                safeNumber(
                    comparisonA?.totals?.reach,
                ) > 0 ||
                comparisonA?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.reach,
                        ) > 0,
                )
            ) &&
            (
                safeNumber(
                    comparisonB?.totals?.reach,
                ) > 0 ||
                comparisonB?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.reach,
                        ) > 0,
                )
            ),
        );

    const comparisonHasAccountViews =
        Boolean(
            comparisonA &&
            comparisonB &&
            (
                safeNumber(
                    comparisonA?.totals?.views,
                ) > 0 ||
                comparisonA?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.views,
                        ) > 0,
                )
            ) &&
            (
                safeNumber(
                    comparisonB?.totals?.views,
                ) > 0 ||
                comparisonB?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.views,
                        ) > 0,
                )
            ),
        );

    const comparisonHasAccountInteractions =
        Boolean(
            comparisonA &&
            comparisonB &&
            (
                safeNumber(
                    comparisonA?.totals
                        ?.engagement,
                ) > 0 ||
                comparisonA?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.engagement,
                        ) > 0,
                )
            ) &&
            (
                safeNumber(
                    comparisonB?.totals
                        ?.engagement,
                ) > 0 ||
                comparisonB?.series?.some(
                    (row: any) =>
                        safeNumber(
                            row?.engagement,
                        ) > 0,
                )
            ),
        );

    const comparisonRows =
        useMemo(() => {
            if (
                !comparisonA ||
                !comparisonB ||
                !comparisonMediaA ||
                !comparisonMediaB
            ) {
                return [];
            }

            /*
             * REACH
             *
             * Prefer account Reach only when BOTH periods
             * contain usable account-level Reach.
             */
            const reachA =
                comparisonHasAccountReach
                    ? safeNumber(
                        comparisonA
                            ?.totals?.reach,
                    )
                    : comparisonMediaA.reach;

            const reachB =
                comparisonHasAccountReach
                    ? safeNumber(
                        comparisonB
                            ?.totals?.reach,
                    )
                    : comparisonMediaB.reach;

            /*
             * VIEWS
             *
             * If account Views are unavailable in either period,
             * compare real media Views for BOTH periods.
             */
            const viewsA =
                comparisonHasAccountViews
                    ? safeNumber(
                        comparisonA
                            ?.totals?.views,
                    )
                    : comparisonMediaA.views;

            const viewsB =
                comparisonHasAccountViews
                    ? safeNumber(
                        comparisonB
                            ?.totals?.views,
                    )
                    : comparisonMediaB.views;

            /*
             * INTERACTIONS
             *
             * If account interactions are unavailable,
             * compare real media interactions for BOTH periods.
             */
            const interactionsA =
                comparisonHasAccountInteractions
                    ? safeNumber(
                        comparisonA
                            ?.totals
                            ?.engagement,
                    )
                    : comparisonMediaA.interactions;

            const interactionsB =
                comparisonHasAccountInteractions
                    ? safeNumber(
                        comparisonB
                            ?.totals
                            ?.engagement,
                    )
                    : comparisonMediaB.interactions;

            const rows = [
                {
                    label:
                        comparisonHasAccountReach
                            ? "Account Reach"
                            : "Content Reach",

                    a: reachA,
                    b: reachB,
                },

                {
                    label:
                        comparisonHasAccountViews
                            ? "Views"
                            : "Content Views",

                    a: viewsA,
                    b: viewsB,
                },

                {
                    label:
                        comparisonHasAccountInteractions
                            ? "Interactions"
                            : "Content Interactions",

                    a: interactionsA,
                    b: interactionsB,
                },

                {
                    label:
                        "Content Published",

                    a:
                        comparisonMediaA.content,

                    b:
                        comparisonMediaB.content,
                },

                {
                    label:
                        "Shares",

                    a:
                        comparisonMediaA.shares,

                    b:
                        comparisonMediaB.shares,
                },

                {
                    label:
                        "Saves",

                    a:
                        comparisonMediaA.saves,

                    b:
                        comparisonMediaB.saves,
                },
            ];

            return rows.map(
                (row) => ({
                    ...row,

                    change:
                        comparisonChange(
                            row.a,
                            row.b,
                        ),
                }),
            );
        }, [
            comparisonA,
            comparisonB,
            comparisonMediaA,
            comparisonMediaB,
            comparisonHasAccountReach,
            comparisonHasAccountViews,
            comparisonHasAccountInteractions,
        ]);

    const comparisonBasisText =
        [
            comparisonHasAccountReach
                ? "Reach: Meta account-level"
                : "Reach: media-level",

            comparisonHasAccountViews
                ? "Views: Meta account-level"
                : "Views: media-level",

            comparisonHasAccountInteractions
                ? "Interactions: Meta account-level"
                : "Interactions: media-level",
        ].join(" · ");

    function reportChart(
        dataKey: string,
        label: string,
    ) {
        const metricHasSeriesData =
            series.some(
                (row: any) =>
                    safeNumber(
                        row?.[dataKey],
                    ) > 0,
            );

        if (!metricHasSeriesData) {
            return (
                <Unavailable
                    title={`${label} trend unavailable`}
                    reason={`Meta did not return usable account-level ${label} trend data for this reporting period.`}
                />
            );
        }

        return (
            <div className="h-64 rounded-2xl border border-border bg-muted/20 p-4">
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    <AreaChart
                        data={series}
                    >
                        <defs>
                            <linearGradient
                                id={`report-${dataKey}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor="#6366f1"
                                    stopOpacity={0.35}
                                />

                                <stop
                                    offset="100%"
                                    stopColor="#6366f1"
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="rgba(127,127,127,.15)"
                        />

                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                                fontSize: 10,
                                fill:
                                    "currentColor",
                            }}
                        />

                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{
                                fontSize: 10,
                                fill:
                                    "currentColor",
                            }}
                            tickFormatter={(value) =>
                                formatCompact(value)
                            }
                        />

                        <Tooltip />

                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            name={label}
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            fill={`url(#report-${dataKey})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    function renderSlide(
        slideIndex: number,
        printMode = false,
    ) {
        const commonProps = {
            editing,
            edits,
            setEdit,
            printMode,
            pageNumber:
                slideIndex + 1,
            totalPages:
                slides.length,
            footerLeft: `${clientName} · ${dateRange}`,
        };

        switch (slideIndex) {
            case 0:
                return (
                    <Slide
                        {...commonProps}
                        title="Social Media Insights Report"
                        eyebrow="Loomic · Instagram"
                        slideId="cover"
                    >
                        <div className="flex h-full min-h-[420px] flex-col justify-between">
                            <div className="max-w-4xl">
                                <EditableText
                                    id="cover.client"
                                    fallback={
                                        clientName
                                    }
                                    editing={
                                        editing &&
                                        !printMode
                                    }
                                    edits={edits}
                                    setEdit={
                                        setEdit
                                    }
                                    className="font-display text-4xl font-semibold lg:text-6xl"
                                />

                                <p className="mt-6 text-xl text-muted-foreground">
                                    {dateRange}
                                </p>

                                <Badge className="mt-6">
                                    Instagram
                                    Insights Report
                                </Badge>
                            </div>

                            <div>
                                <p className="text-sm font-medium">
                                    Prepared in
                                    Loomic
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    Data is based
                                    on connected
                                    Instagram
                                    Insights and
                                    synced media
                                    performance.
                                </p>
                            </div>
                        </div>
                    </Slide>
                );

            case 1:
                return (
                    <Slide
                        {...commonProps}
                        title="Overview"
                        eyebrow={dateRange}
                        slideId="overview"
                    >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                {
                                    label:
                                        reachMetric.label,
                                    value:
                                        reachMetric.value,
                                    comparison:
                                        reachMetric.comparison,
                                },
                                {
                                    label:
                                        viewsMetric.label,
                                    value:
                                        viewsMetric.value,
                                    comparison:
                                        viewsMetric.comparison,
                                },
                                {
                                    label:
                                        interactionsMetric.label,
                                    value:
                                        interactionsMetric.value,
                                    comparison:
                                        interactionsMetric.comparison,
                                },
                                {
                                    label:
                                        "Content Published",
                                    value:
                                        content.length,
                                    comparison:
                                        comparisons.contentPublished,
                                },
                                {
                                    label:
                                        "Shares",
                                    value:
                                        mediaTotals.shares,
                                    comparison: null,
                                },
                                {
                                    label:
                                        "Saves",
                                    value:
                                        mediaTotals.saves,
                                    comparison: null,
                                },
                            ].map(
                                (item) => (
                                    <Card
                                        key={
                                            item.label
                                        }
                                    >
                                        <CardContent className="p-5">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                {
                                                    item.label
                                                }
                                            </p>

                                            <p className="mt-2 text-3xl font-semibold">
                                                {metric(
                                                    item.value,
                                                )}
                                            </p>

                                            {item.comparison !==
                                                null &&
                                                item.comparison !==
                                                undefined && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {comparisonText(
                                                            item.comparison,
                                                        )}
                                                    </p>
                                                )}
                                        </CardContent>
                                    </Card>
                                ),
                            )}
                        </div>

                        <div className="mt-5">
                            <Notes
                                prefix="overview"
                                wins={[
                                    `${content.length} Instagram content item(s) were analysed for the selected period.`,
                                    topReachContent
                                        ? `The top-performing content reached ${formatCompact(
                                            safeNumber(
                                                topReachContent.reach,
                                            ),
                                        )}.`
                                        : "No media performance was available for the selected period.",
                                ]}
                                improve={[
                                    hasAccountSnapshots
                                        ? deltaSentence(
                                            reachMetric.label,
                                            reachMetric.comparison,
                                        )
                                        : "Historical account-level Reach, profile activity and audience totals are not available for this period unless Loomic had stored those snapshots at the time.",
                                ]}
                                recommendations={
                                    intelligence.recommendations?.slice(
                                        0,
                                        3,
                                    ) ?? [
                                        "Repeat the creative patterns and themes used by the strongest-performing content.",
                                    ]
                                }
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 2:
                return (
                    <Slide
                        {...commonProps}
                        title="Reach"
                        eyebrow={dateRange}
                        slideId="reach"
                    >
                        <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
                            {reportChart(
                                "reach",
                                "Account Reach",
                            )}

                            <Card>
                                <CardContent className="p-6">
                                    <Eye className="h-6 w-6 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        {
                                            reachMetric.label
                                        }
                                    </p>

                                    <p className="mt-2 text-4xl font-semibold">
                                        {metric(
                                            reachMetric.value,
                                        )}
                                    </p>

                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                        {
                                            reachMetric.source
                                        }
                                    </p>

                                    {reachMetric.comparison !==
                                        null &&
                                        reachMetric.comparison !==
                                        undefined && (
                                            <p className="mt-3 text-xs">
                                                {comparisonText(
                                                    reachMetric.comparison,
                                                )}
                                            </p>
                                        )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-5">
                            <Notes
                                prefix="reach"
                                wins={[
                                    topReachContent
                                        ? `The highest-reaching content generated ${formatCompact(
                                            safeNumber(
                                                topReachContent.reach,
                                            ),
                                        )} Reach.`
                                        : "No media Reach was available.",
                                ]}
                                improve={[
                                    !hasAccountSnapshots
                                        ? "Account-level historical Reach cannot be reconstructed from individual post Reach because the audiences can overlap."
                                        : deltaSentence(
                                            "Account Reach",
                                            comparisons.reach,
                                        ),
                                ]}
                                recommendations={[
                                    "Repeat creative patterns from the highest-reaching posts.",
                                    "Use media Reach and interactions together when evaluating content quality.",
                                ]}
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 3:
                return (
                    <Slide
                        {...commonProps}
                        title="Views"
                        eyebrow={dateRange}
                        slideId="views"
                    >
                        <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
                            {reportChart(
                                "views",
                                "Views",
                            )}

                            <Card>
                                <CardContent className="p-6">
                                    <Film className="h-6 w-6 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        {
                                            viewsMetric.label
                                        }
                                    </p>

                                    <p className="mt-2 text-4xl font-semibold">
                                        {metric(
                                            viewsMetric.value,
                                        )}
                                    </p>

                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                        {
                                            viewsMetric.source
                                        }
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-5">
                            <Notes
                                prefix="views"
                                wins={[
                                    content.length
                                        ? `${formatCompact(
                                            mediaTotals.views,
                                        )} media Views were recorded across content published in the selected period.`
                                        : "No content Views were available.",
                                ]}
                                improve={[
                                    "Review content with high Reach but comparatively low Views or interactions.",
                                ]}
                                recommendations={[
                                    "Strengthen opening hooks on Reels and other video content.",
                                    "Repeat formats associated with the strongest Views and Reach.",
                                ]}
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 4:
                return (
                    <Slide
                        {...commonProps}
                        title="Interactions"
                        eyebrow={dateRange}
                        slideId="interactions"
                    >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {[
                                [
                                    "Interactions",
                                    mediaTotals.interactions,
                                ],
                                [
                                    "Likes",
                                    mediaTotals.likes,
                                ],
                                [
                                    "Comments",
                                    mediaTotals.comments,
                                ],
                                [
                                    "Shares",
                                    mediaTotals.shares,
                                ],
                                [
                                    "Saves",
                                    mediaTotals.saves,
                                ],
                            ].map(
                                ([
                                    label,
                                    value,
                                ]) => (
                                    <Card
                                        key={String(
                                            label,
                                        )}
                                    >
                                        <CardContent className="p-5">
                                            <p className="text-[11px] uppercase text-muted-foreground">
                                                {label}
                                            </p>

                                            <p className="mt-2 text-3xl font-semibold">
                                                {metric(
                                                    value as number,
                                                )}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ),
                            )}
                        </div>

                        <div className="mt-6">
                            <Notes
                                prefix="interactions"
                                wins={[
                                    `${formatCompact(
                                        mediaTotals.interactions,
                                    )} interactions were calculated from the real selected-period media rows.`,
                                    `${formatNumber(
                                        mediaTotals.shares,
                                    )} shares and ${formatNumber(
                                        mediaTotals.saves,
                                    )} saves were recorded.`,
                                ]}
                                improve={[
                                    "Identify posts receiving Reach but very few shares, saves or comments.",
                                ]}
                                recommendations={[
                                    "Repeat save-worthy and share-worthy content topics.",
                                    "Use clearer engagement CTAs where relevant.",
                                ]}
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 5:
                return (
                    <Slide
                        {...commonProps}
                        title="Current Audience Demographics"
                        eyebrow="Latest available Meta audience data"
                        slideId="demographics"
                    >
                        {extrasLoading ? (
                            <Unavailable
                                title="Loading demographics"
                                reason="Loomic is requesting the latest audience breakdown available from Meta."
                            />
                        ) : extras?.demographics?.available ? (
                            <>
                                <div className="grid gap-6 lg:grid-cols-3">
                                    <Card>
                                        <CardContent className="p-5">
                                            <h3 className="mb-4 font-semibold">
                                                Age
                                            </h3>

                                            <ProgressRows
                                                rows={
                                                    extras.demographics.age ??
                                                    []
                                                }
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-5">
                                            <h3 className="mb-4 font-semibold">
                                                Gender
                                            </h3>

                                            <ProgressRows
                                                rows={
                                                    extras.demographics.gender ??
                                                    []
                                                }
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-5">
                                            <h3 className="mb-4 font-semibold">
                                                Top Cities
                                            </h3>

                                            <ProgressRows
                                                rows={
                                                    extras.demographics.city ??
                                                    []
                                                }
                                            />
                                        </CardContent>
                                    </Card>
                                </div>

                                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                                    This slide represents the latest audience demographics returned by Meta. It should not be interpreted as the historical demographic composition on {dateRange}.
                                </p>
                            </>
                        ) : (
                            <Unavailable
                                title="Audience demographics unavailable"
                                reason={
                                    extras?.reason ??
                                    "Meta did not return demographic data for this account."
                                }
                            />
                        )}
                    </Slide>
                );

            case 6:
                return (
                    <Slide
                        {...commonProps}
                        title="Followers"
                        eyebrow={dateRange}
                        slideId="followers"
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Card>
                                <CardContent className="p-6">
                                    <Users className="h-5 w-5 text-primary" />

                                    <p className="mt-4 text-xs uppercase text-muted-foreground">
                                        Current Followers
                                    </p>

                                    <p className="mt-2 text-4xl font-semibold">
                                        {metric(
                                            currentFollowers,
                                        )}
                                    </p>

                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Latest connected account total
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <UserPlus className="h-5 w-5 text-primary" />

                                    <p className="mt-4 text-xs uppercase text-muted-foreground">
                                        Follower Growth During Period
                                    </p>

                                    <p className="mt-2 text-4xl font-semibold">
                                        {historicalFollowerGrowthAvailable
                                            ? `${safeNumber(
                                                totals.followerGrowth,
                                            ) >= 0
                                                ? "+"
                                                : ""}${numberMetric(
                                                    safeNumber(
                                                        totals.followerGrowth,
                                                    ),
                                                )}`
                                            : "N/A"}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <Heart className="h-5 w-5 text-primary" />

                                    <p className="mt-4 text-xs uppercase text-muted-foreground">
                                        Growth %
                                    </p>

                                    <p className="mt-2 text-4xl font-semibold">
                                        {historicalFollowerGrowthAvailable
                                            ? percentage(
                                                totals.followerGrowthPct,
                                            )
                                            : "N/A"}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {historicalRange && (
                            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-muted-foreground">
                                The current follower total is the latest account value. Loomic does not present it as the follower count that existed during this historical reporting period.
                            </div>
                        )}

                        <div className="mt-5">
                            <Notes
                                prefix="followers"
                                wins={[
                                    `The connected account currently has ${formatNumber(
                                        currentFollowers,
                                    )} followers.`,
                                ]}
                                improve={[
                                    historicalFollowerGrowthAvailable
                                        ? "Review which selected-period content contributed most strongly to follower growth."
                                        : "Historical follower growth is unavailable because point-in-time follower snapshots were not stored for this period.",
                                ]}
                                recommendations={[
                                    "Use strong Follow CTAs on high-performing content.",
                                    "Continue building follower snapshot history for accurate future period-over-period reports.",
                                ]}
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 7:
                return (
                    <Slide
                        {...commonProps}
                        title="Best-Performing Publishing Time"
                        eyebrow="Derived from selected-period content performance"
                        slideId="posting-time"
                    >
                        <div className="grid gap-5 sm:grid-cols-3">
                            <Card>
                                <CardContent className="p-6">
                                    <Clock3 className="h-6 w-6 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        Best Time
                                    </p>

                                    <p className="mt-2 text-2xl font-semibold">
                                        {intelligence.bestTime?.name ??
                                            "Need more data"}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <BarChart3 className="h-6 w-6 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        Best Day
                                    </p>

                                    <p className="mt-2 text-2xl font-semibold">
                                        {intelligence.bestDay?.name ??
                                            "Need more data"}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <Film className="h-6 w-6 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        Best Format
                                    </p>

                                    <p className="mt-2 text-2xl font-semibold">
                                        {intelligence.bestFormat?.name ??
                                            "Need more data"}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <p className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                            These recommendations are calculated from the actual publishing times and performance of content in the selected period. They are not the same as Meta&apos;s follower-online audience activity metric.
                        </p>

                        <div className="mt-5">
                            <Notes
                                prefix="posting-time"
                                wins={[
                                    intelligence.bestDay
                                        ? `${intelligence.bestDay.name} produced the strongest average content performance.`
                                        : "More publishing history is needed.",
                                    intelligence.bestTime
                                        ? `${intelligence.bestTime.name} produced the strongest average content performance.`
                                        : "More content is needed to establish a strong time pattern.",
                                ]}
                                improve={[
                                    "Avoid deciding future schedules from a single high-performing post.",
                                ]}
                                recommendations={[
                                    intelligence.bestTime
                                        ? `Test priority content around ${intelligence.bestTime.name}.`
                                        : "Continue collecting publishing data.",
                                ]}
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                            />
                        </div>
                    </Slide>
                );

            case 8:
                return (
                    <Slide
                        {...commonProps}
                        title="Reel Skip Rate"
                        eyebrow={dateRange}
                        slideId="skip-rate"
                    >
                        {extras?.skipRate?.available ? (
                            <div className="grid gap-6 lg:grid-cols-[.65fr_1.35fr]">
                                <Card>
                                    <CardContent className="p-7">
                                        <Gauge className="h-7 w-7 text-primary" />

                                        <p className="mt-5 text-xs uppercase text-muted-foreground">
                                            Average Skip Rate
                                        </p>

                                        <p className="mt-2 text-5xl font-semibold">
                                            {extras.skipRate.averagePct}%
                                        </p>

                                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                            Calculated only from Reels where Meta returned reels_skip_rate.
                                        </p>
                                    </CardContent>
                                </Card>

                                <div className="space-y-3">
                                    {extras.skipRate.items
                                        ?.slice(0, 5)
                                        .map((item: any) => (
                                            <div
                                                key={item.externalMediaId}
                                                className="flex items-center gap-4 rounded-xl border border-border p-3"
                                            >
                                                {item.thumbnailUrl && (
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt=""
                                                        className="h-16 w-16 rounded-lg object-cover"
                                                    />
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-1 text-sm font-medium">
                                                        {item.caption ||
                                                            "Instagram Reel"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Reel Skip Rate
                                                    </p>
                                                </div>

                                                <p className="text-xl font-semibold">
                                                    {item.ratePct}%
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ) : (
                            <Unavailable
                                title="Reel Skip Rate unavailable"
                                reason="Meta did not return reels_skip_rate for Reels in this reporting period. Loomic does not estimate or fabricate this value."
                            />
                        )}
                    </Slide>
                );

            case 9:
                return (
                    <Slide
                        {...commonProps}
                        title="Follower vs Non-Follower Reach"
                        eyebrow={dateRange}
                        slideId="follower-ratio"
                    >
                        {extras?.followerNonFollower?.available ? (
                            <>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Card>
                                        <CardContent className="p-7">
                                            <p className="text-xs uppercase text-muted-foreground">
                                                Follower Reach
                                            </p>

                                            <p className="mt-2 text-4xl font-semibold">
                                                {metric(
                                                    extras.followerNonFollower
                                                        .followerReach,
                                                )}
                                            </p>

                                            <p className="mt-2 text-sm text-muted-foreground">
                                                {extras.followerNonFollower
                                                    .followerPct ?? "N/A"}
                                                %
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-7">
                                            <p className="text-xs uppercase text-muted-foreground">
                                                Non-Follower Reach
                                            </p>

                                            <p className="mt-2 text-4xl font-semibold">
                                                {metric(
                                                    extras.followerNonFollower
                                                        .nonFollowerReach,
                                                )}
                                            </p>

                                            <p className="mt-2 text-sm text-muted-foreground">
                                                {extras.followerNonFollower
                                                    .nonFollowerPct ?? "N/A"}
                                                %
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="mt-6 flex h-7 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full bg-primary"
                                        style={{
                                            width: `${extras.followerNonFollower
                                                .followerPct ?? 0
                                                }%`,
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <Unavailable
                                title="Follower / Non-Follower breakdown unavailable"
                                reason="Meta did not return a follower/non-follower Reach breakdown for this account and reporting period."
                            />
                        )}
                    </Slide>
                );

            case 10:
                return (
                    <Slide
                        {...commonProps}
                        title="Profile Visits"
                        eyebrow={dateRange}
                        slideId="profile-visits"
                    >
                        {profileVisitsAvailable ? (
                            <div className="grid gap-6 lg:grid-cols-[.65fr_1.35fr]">
                                <Card>
                                    <CardContent className="p-7">
                                        <Eye className="h-7 w-7 text-primary" />

                                        <p className="mt-5 text-xs uppercase text-muted-foreground">
                                            Profile Visits
                                        </p>

                                        <p className="mt-2 text-5xl font-semibold">
                                            {metric(
                                                totals.profileViews,
                                            )}
                                        </p>

                                        <p className="mt-3 text-sm text-muted-foreground">
                                            {comparisonText(
                                                comparisons.profileViews,
                                            )}
                                        </p>
                                    </CardContent>
                                </Card>

                                {reportChart(
                                    "profileViews",
                                    "Profile Visits",
                                )}
                            </div>
                        ) : (
                            <Unavailable
                                title="Historical Profile Visits unavailable"
                                reason="Loomic does not have stored Meta account-level profile activity snapshots for this historical reporting period."
                            />
                        )}
                    </Slide>
                );

            case 11:
                return (
                    <Slide
                        {...commonProps}
                        title="Top Performing Content"
                        eyebrow={dateRange}
                        slideId="top-content"
                    >
                        {topContent.length ? (
                            <div
                                className={
                                    printMode
                                        ? "sf-top-content-grid"
                                        : "grid gap-5 md:grid-cols-3"
                                }
                            >
                                {topContent.map(
                                    (
                                        item: any,
                                        index: number,
                                    ) => (
                                        <Card
                                            key={item.id}
                                            className={
                                                printMode
                                                    ? "sf-top-content-card overflow-hidden"
                                                    : "overflow-hidden"
                                            }
                                        >
                                            {item.thumbnailUrl && (
                                                <div
                                                    className={
                                                        printMode
                                                            ? "sf-top-content-image overflow-hidden bg-muted"
                                                            : "aspect-[16/10] overflow-hidden bg-muted"
                                                    }
                                                >
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            <CardContent
                                                className={
                                                    printMode
                                                        ? "sf-top-content-body p-4"
                                                        : "p-4"
                                                }
                                            >
                                                <Badge>
                                                    #{index + 1} {item.format}
                                                </Badge>

                                                <p className="mt-3 line-clamp-2 text-sm font-medium">
                                                    {item.caption ||
                                                        "Instagram content"}
                                                </p>

                                                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Reach
                                                        </span>

                                                        <p className="font-semibold">
                                                            {formatCompact(
                                                                safeNumber(
                                                                    item.reach,
                                                                ),
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Views
                                                        </span>

                                                        <p className="font-semibold">
                                                            {formatCompact(
                                                                safeNumber(
                                                                    item.views,
                                                                ),
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Shares
                                                        </span>

                                                        <p className="font-semibold">
                                                            {formatNumber(
                                                                safeNumber(
                                                                    item.shares,
                                                                ),
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Saves
                                                        </span>

                                                        <p className="font-semibold">
                                                            {formatNumber(
                                                                safeNumber(
                                                                    item.saves,
                                                                ),
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ),
                                )}
                            </div>
                        ) : (
                            <Unavailable
                                title="No selected-period content"
                                reason="No synced Instagram media exists inside this reporting period."
                            />
                        )}

                        <p className="mt-4 text-xs text-muted-foreground">
                            Content images are the actual synced Instagram thumbnails.
                        </p>
                    </Slide>
                );

            case 12:
                return (
                    <Slide
                        {...commonProps}
                        title="Best Performing Hashtags / Keywords"
                        eyebrow="Derived from selected-period media performance"
                        slideId="hashtags-keywords"
                    >
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card>
                                <CardContent className="p-5">
                                    <div className="mb-4 flex items-center gap-2">
                                        <Hash className="h-5 w-5 text-primary" />

                                        <h3 className="font-semibold">
                                            Hashtags
                                        </h3>
                                    </div>

                                    <div className="space-y-2">
                                        {hashtags.map(
                                            (
                                                item,
                                                index,
                                            ) => (
                                                <div
                                                    key={item.name}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {index +
                                                                1}
                                                            .{" "}
                                                            {
                                                                item.name
                                                            }
                                                        </p>

                                                        <p className="text-[11px] text-muted-foreground">
                                                            {
                                                                item.posts
                                                            }{" "}
                                                            post(s)
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold">
                                                            {formatCompact(
                                                                item.avgReach,
                                                            )}
                                                        </p>

                                                        <p className="text-[11px] text-muted-foreground">
                                                            avg reach
                                                        </p>
                                                    </div>
                                                </div>
                                            ),
                                        )}

                                        {!hashtags.length && (
                                            <p className="text-sm text-muted-foreground">
                                                No hashtags found in selected-period captions.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-5">
                                    <div className="mb-4 flex items-center gap-2">
                                        <Hash className="h-5 w-5 text-primary" />

                                        <h3 className="font-semibold">
                                            Keywords
                                        </h3>
                                    </div>

                                    <div className="space-y-2">
                                        {keywords.map(
                                            (
                                                item,
                                                index,
                                            ) => (
                                                <div
                                                    key={item.name}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {index +
                                                                1}
                                                            .{" "}
                                                            {
                                                                item.name
                                                            }
                                                        </p>

                                                        <p className="text-[11px] text-muted-foreground">
                                                            {
                                                                item.posts
                                                            }{" "}
                                                            post(s)
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold">
                                                            {formatCompact(
                                                                item.avgReach,
                                                            )}
                                                        </p>

                                                        <p className="text-[11px] text-muted-foreground">
                                                            avg reach
                                                        </p>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <p className="mt-4 text-xs leading-5 text-muted-foreground">
                            This is a Loomic-derived ranking based on caption usage, media Reach and interactions. It is not presented as a native Meta hashtag analytics metric.
                        </p>
                    </Slide>
                );

            case 13:
                return (
                    <Slide
                        {...commonProps}
                        title="Ad Reach"
                        eyebrow={dateRange}
                        slideId="ad-reach"
                    >
                        {extras?.adReach?.available ? (
                            <Card>
                                <CardContent className="p-8">
                                    <Megaphone className="h-8 w-8 text-primary" />

                                    <p className="mt-5 text-xs uppercase text-muted-foreground">
                                        Paid Ad Reach
                                    </p>

                                    <p className="mt-2 text-5xl font-semibold">
                                        {metric(
                                            extras.adReach.value,
                                        )}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Unavailable
                                title="Ad Reach unavailable"
                                reason={
                                    extras?.adReach?.reason ??
                                    "Paid Ad Reach requires a compatible Meta Marketing API connection and ads permission. Organic Instagram Reach is not substituted for paid Reach."
                                }
                            />
                        )}
                    </Slide>
                );

            case 14:
                return (
                    <Slide
                        {...commonProps}
                        title="Date Comparison"
                        eyebrow="Custom period vs custom period"
                        slideId="date-comparison"
                    >
                        {comparisonReady &&
                            comparisonMediaA &&
                            comparisonMediaB ? (
                            <div className="space-y-4">

                                {/* PERIODS */}
                                <div className="grid grid-cols-2 gap-3">
                                    <Card>
                                        <CardContent className="p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                                                Period A
                                            </p>

                                            <p className="mt-1 text-base font-semibold">
                                                {displayReportDate(
                                                    compareFromA,
                                                )}{" "}
                                                –{" "}
                                                {displayReportDate(
                                                    compareToA,
                                                )}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500">
                                                Period B
                                            </p>

                                            <p className="mt-1 text-base font-semibold">
                                                {displayReportDate(
                                                    compareFromB,
                                                )}{" "}
                                                –{" "}
                                                {displayReportDate(
                                                    compareToB,
                                                )}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* GRAPH + CHANGE */}
                                <div className="grid grid-cols-[1.15fr_.85fr] gap-4">

                                    {/* LEFT */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <h3 className="mb-3 text-sm font-semibold">
                                                Performance Comparison
                                            </h3>

                                            <ComparisonGraph
                                                rows={comparisonRows}
                                                periodALabel={`${displayReportDate(
                                                    compareFromA,
                                                )} – ${displayReportDate(
                                                    compareToA,
                                                )}`}
                                                periodBLabel={`${displayReportDate(
                                                    compareFromB,
                                                )} – ${displayReportDate(
                                                    compareToB,
                                                )}`}
                                            />
                                        </CardContent>
                                    </Card>

                                    {/* RIGHT */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <h3 className="mb-3 text-sm font-semibold">
                                                Change from Period A to Period B
                                            </h3>

                                            <div className="space-y-2">
                                                {comparisonRows.map(
                                                    (row) => (
                                                        <div
                                                            key={row.label}
                                                            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium">
                                                                    {row.label}
                                                                </p>

                                                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                                    {formatCompact(
                                                                        row.a,
                                                                    )}{" "}
                                                                    →{" "}
                                                                    {formatCompact(
                                                                        row.b,
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <p
                                                                className={`shrink-0 text-xs font-bold ${row.change === null
                                                                    ? "text-muted-foreground"
                                                                    : row.change >= 0
                                                                        ? "text-emerald-500"
                                                                        : "text-rose-500"
                                                                    }`}
                                                            >
                                                                {row.change === null
                                                                    ? "New"
                                                                    : `${row.change >= 0
                                                                        ? "+"
                                                                        : ""
                                                                    }${row.change}%`}
                                                            </p>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* SOURCE NOTE */}
                                <p className="text-[10px] leading-4 text-muted-foreground">
                                    Comparison basis:{" "}
                                    {comparisonBasisText}.
                                    Period B percentage changes are calculated against Period A.
                                </p>
                            </div>
                        ) : (
                            <Unavailable
                                title="Date comparison not applied"
                                reason="Click Compare Dates, choose Period A and Period B, then click Apply Comparison."
                            />
                        )}
                    </Slide>
                );

            default:
                return (
                    <Slide
                        {...commonProps}
                        title="Thank You"
                        eyebrow="Loomic"
                        slideId="thank-you"
                    >
                        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                            <EditableText
                                id="thank-you.client"
                                fallback={
                                    clientName
                                }
                                editing={
                                    editing &&
                                    !printMode
                                }
                                edits={edits}
                                setEdit={
                                    setEdit
                                }
                                className="font-display text-4xl font-semibold lg:text-5xl"
                            />

                            <p className="mt-5 text-xl text-muted-foreground">
                                {dateRange}
                            </p>

                            <p className="mt-10 text-sm text-muted-foreground">
                                Social Media Insights Report
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                                Generated through Loomic Analytics
                            </p>
                        </div>
                    </Slide>
                );
        }
    }

    async function loadDateComparison() {
        if (
            !compareFromA ||
            !compareToA ||
            !compareFromB ||
            !compareToB
        ) {
            setComparisonError(
                "Select all four comparison dates.",
            );

            return;
        }

        if (
            compareFromA >
            compareToA
        ) {
            setComparisonError(
                "Period A From date must be before its To date.",
            );

            return;
        }

        if (
            compareFromB >
            compareToB
        ) {
            setComparisonError(
                "Period B From date must be before its To date.",
            );

            return;
        }

        setComparisonLoading(true);
        setComparisonError("");

        try {
            const createParams = (
                from: string,
                to: string,
            ) => {
                const params =
                    new URLSearchParams(
                        queryString,
                    );

                params.set(
                    "range",
                    "custom",
                );

                params.set(
                    "from",
                    from,
                );

                params.set(
                    "to",
                    to,
                );

                return params;
            };

            const paramsA =
                createParams(
                    compareFromA,
                    compareToA,
                );

            const paramsB =
                createParams(
                    compareFromB,
                    compareToB,
                );

            const [
                responseA,
                responseB,
            ] = await Promise.all([
                authenticatedFetch(
                    `/api/v1/analytics/summary?${paramsA.toString()}`,
                ),

                authenticatedFetch(
                    `/api/v1/analytics/summary?${paramsB.toString()}`,
                ),
            ]);

            const [
                jsonA,
                jsonB,
            ] = await Promise.all([
                responseA.json(),
                responseB.json(),
            ]);

            if (!responseA.ok) {
                throw new Error(
                    jsonA.error?.message ??
                    "Could not load Period A.",
                );
            }

            if (!responseB.ok) {
                throw new Error(
                    jsonB.error?.message ??
                    "Could not load Period B.",
                );
            }

            setComparisonA(
                jsonA.data,
            );

            setComparisonB(
                jsonB.data,
            );

            // Date Comparison is index 14.
            setSlide(14);

            setCompareOpen(false);
        } catch (error) {
            setComparisonError(
                error instanceof Error
                    ? error.message
                    : "Could not compare these dates.",
            );
        } finally {
            setComparisonLoading(false);
        }
    }

    function downloadPdf() {
        /*
         * All 15 slides already exist inside
         * #socialflow-print-report.
         *
         * CSS hides everything except that container
         * during printing.
         */
        window.print();
    }

    return (
        <>
            {/* Browser / interactive report */}
            <div
                id="socialflow-insights-report"
                className="sf-no-print space-y-4"
            >
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold">
                            Editable Insights Report
                        </p>

                        <p className="text-xs text-muted-foreground">
                            Slide {slide + 1} of{" "}
                            {slides.length} ·{" "}
                            {slides[slide]}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={
                                editing
                                    ? "secondary"
                                    : "outline"
                            }
                            size="sm"
                            onClick={() =>
                                setEditing(
                                    (current) =>
                                        !current,
                                )
                            }
                        >
                            <Pencil className="mr-1.5 h-4 w-4" />

                            {editing
                                ? "Editing On"
                                : "Edit Report"}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetEdits}
                        >
                            <RotateCcw className="mr-1.5 h-4 w-4" />
                            Reset Text
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const element =
                                    document.getElementById(
                                        "socialflow-insights-report",
                                    );

                                void element?.requestFullscreen?.();
                            }}
                        >
                            <Maximize2 className="mr-1.5 h-4 w-4" />
                            Full Screen
                        </Button>

                        <Button
                            variant={
                                compareOpen
                                    ? "secondary"
                                    : "outline"
                            }
                            size="sm"
                            onClick={() =>
                                setCompareOpen(
                                    (current) =>
                                        !current,
                                )
                            }
                        >
                            <BarChart3 className="mr-1.5 h-4 w-4" />
                            Compare Dates
                        </Button>

                        <Button
                            size="sm"
                            onClick={downloadPdf}
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </div>

                {renderSlide(
                    slide,
                    false,
                )}

                {compareOpen && (
                    <Card className="border-primary/20 bg-muted/30">
                        <CardContent className="p-5">
                            <div className="mb-4">
                                <h3 className="font-semibold">
                                    Custom Date Comparison
                                </h3>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    Compare any two custom Instagram reporting periods.
                                </p>
                            </div>

                            <div className="grid gap-5 xl:grid-cols-[1fr_auto_1fr_auto] xl:items-end">
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
                                        Period A
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="grid gap-1.5">
                                            <span className="text-xs text-muted-foreground">
                                                From
                                            </span>

                                            <input
                                                type="date"
                                                value={
                                                    compareFromA
                                                }
                                                onChange={(event) =>
                                                    setCompareFromA(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                                            />
                                        </label>

                                        <label className="grid gap-1.5">
                                            <span className="text-xs text-muted-foreground">
                                                To
                                            </span>

                                            <input
                                                type="date"
                                                value={
                                                    compareToA
                                                }
                                                onChange={(event) =>
                                                    setCompareToA(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="hidden pb-2 text-center text-sm font-bold text-muted-foreground xl:block">
                                    VS
                                </div>

                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-500">
                                        Period B
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="grid gap-1.5">
                                            <span className="text-xs text-muted-foreground">
                                                From
                                            </span>

                                            <input
                                                type="date"
                                                value={
                                                    compareFromB
                                                }
                                                onChange={(event) =>
                                                    setCompareFromB(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                                            />
                                        </label>

                                        <label className="grid gap-1.5">
                                            <span className="text-xs text-muted-foreground">
                                                To
                                            </span>

                                            <input
                                                type="date"
                                                value={
                                                    compareToB
                                                }
                                                onChange={(event) =>
                                                    setCompareToB(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <Button
                                    onClick={
                                        loadDateComparison
                                    }
                                    disabled={
                                        comparisonLoading
                                    }
                                >
                                    {comparisonLoading
                                        ? "Comparing..."
                                        : "Apply Comparison"}
                                </Button>
                            </div>

                            {comparisonError && (
                                <p className="mt-3 text-sm text-rose-500">
                                    {comparisonError}
                                </p>
                            )}

                            <p className="mt-4 text-xs text-muted-foreground">
                                Example: Period A 1 Jul 2026 – 15 Jul 2026 versus Period B 16 Jul 2026 – 31 Jul 2026.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        disabled={slide === 0}
                        onClick={() =>
                            setSlide(
                                (current) =>
                                    Math.max(
                                        0,
                                        current - 1,
                                    ),
                            )
                        }
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                    </Button>

                    <div className="flex max-w-[60%] gap-1 overflow-x-auto">
                        {slides.map(
                            (
                                name,
                                index,
                            ) => (
                                <button
                                    key={name}
                                    title={name}
                                    onClick={() =>
                                        setSlide(
                                            index,
                                        )
                                    }
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${index ===
                                        slide
                                        ? "bg-primary"
                                        : "bg-muted-foreground/25"
                                        }`}
                                />
                            ),
                        )}
                    </div>

                    <Button
                        variant="outline"
                        disabled={
                            slide ===
                            slides.length - 1
                        }
                        onClick={() =>
                            setSlide(
                                (current) =>
                                    Math.min(
                                        slides.length -
                                        1,
                                        current + 1,
                                    ),
                            )
                        }
                    >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/*
        PRINT DOCUMENT

        IMPORTANT:
        Unlike the browser version, this renders ALL 15
        slides in the DOM at the same time.
      */}
            <div
                id="socialflow-print-report"
                className="sf-print-only"
            >
                {slides.map(
                    (
                        _name,
                        index,
                    ) => (
                        <div
                            key={`print-slide-${index}`}
                        >
                            {renderSlide(
                                index,
                                true,
                            )}
                        </div>
                    ),
                )}
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
            .sf-print-only {
              display: none;
            }

            @media print {
              @page {
                size: A4 landscape;
                margin: 0;
              }

              .sf-top-content-grid {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 6mm !important;
                align-items: start !important;
                width: 100% !important;
            }

            .sf-top-content-card {
                width: 100% !important;
                max-width: none !important;
                height: auto !important;
                align-self: start !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .sf-top-content-image {
                width: 100% !important;
                height: 58mm !important;
                min-height: 58mm !important;
                max-height: 58mm !important;
            }

            .sf-top-content-image img {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
            }

            .sf-top-content-body {
                min-height: 48mm !important;
            }
                
              html,
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }

              body * {
                visibility: hidden !important;
              }

              #socialflow-print-report,
              #socialflow-print-report * {
                visibility: visible !important;
              }

              #socialflow-print-report {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;

                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .sf-no-print {
                display: none !important;
              }

              .sf-report-page {
                width: 297mm !important;
                height: 210mm !important;
                min-width: 297mm !important;
                max-width: 297mm !important;
                min-height: 210mm !important;
                max-height: 210mm !important;

                margin: 0 !important;
                padding: 0 !important;

                border-radius: 0 !important;
                box-shadow: none !important;

                overflow: hidden !important;

                break-after: page !important;
                page-break-after: always !important;

                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .sf-report-page:last-child {
                break-after: auto !important;
                page-break-after: auto !important;
              }

              .sf-report-footer {
                flex-shrink: 0 !important;
              }

              button {
                display: none !important;
              }

              a {
                text-decoration: none !important;
              }
            }
          `,
                }}
            />
        </>
    );
}