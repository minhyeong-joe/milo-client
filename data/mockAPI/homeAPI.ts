import { BabyProfile, RoutineDay } from "../homeData";

export type HomeMockApiResponse = {
    baby: BabyProfile;
    dailyLogs: RoutineDay[];
};

export const homeMockApiResponse = {
    baby: {
        name: "Elliot",
        birthdate: "2025-05-05",
    },
    dailyLogs: [
        {
            date: "2026-05-01",
            summary: {
                meals: {
                    totalCount: 4,
                    byType: {
                        breastfeed: {
                            count: 2,
                            totalMinutes: 30,
                        },
                        breastMilk: {
                            count: 0,
                            totalAmountMl: 0,
                        },
                        formula: {
                            count: 1,
                            totalAmountMl: 180,
                        },
                        solid: {
                            count: 1,
                            totalServings: 1
                        }
                    }
                },
                diapers: {
                    totalChanges: 3,
                    byType: { wet: 2, dirty: 1, both: 0, dry: 0 },
                },
                sleep: {
                    totalSessions: 3,
                    totalMinutes: 680,
                    byType: {
                        nap: { count: 2, totalMinutes: 120 },
                        nighttime: { count: 1, totalMinutes: 560 },
                    },
                },
            },
            timeline: [
                {
                    id: "sleep-1245",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-05-01T12:45:00",
                    endTime: "2026-05-01T13:25:00",
                },
                {
                    id: "meal-1230",
                    kind: "meal",
                    time: "2026-05-01T12:30:00",
                    type: "formula",
                    amountMl: 180,
                    notes: "Finished bottle calmly.",
                },
                {
                    id: "diaper-1145",
                    kind: "diaper",
                    time: "2026-05-01T11:45:00",
                    type: "wet",
                    notes: "Normal amount.",
                },
                {
                    id: "sleep-0930",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-05-01T09:30:00",
                    endTime: "2026-05-01T10:50:00",
                },
                {
                    id: "meal-0715",
                    kind: "meal",
                    time: "2026-05-01T07:15:00",
                    type: "breastfeed",
                    durationMinutes: 15,
                },
                {
                    id: "diaper-0650",
                    kind: "diaper",
                    time: "2026-05-01T06:50:00",
                    type: "dirty",
                    color: "brown",
                    notes: "Soft consistency.",
                },
                {
                    id: "sleep-0630",
                    kind: "sleep",
                    type: "nighttime",
                    startTime: "2026-04-30T21:10:00",
                    endTime: "2026-05-01T06:30:00",
                },
            ]
        },
        {
            date: "2026-04-30",
            summary: {
                meals: {
                    totalCount: 5,
                    byType: {
                        breastfeed: {
                            count: 2,
                            totalMinutes: 30,
                        },
                        breastMilk: {
                            count: 1,
                            totalAmountMl: 60,
                        },
                        formula: {
                            count: 1,
                            totalAmountMl: 180,
                        },
                        solid: {
                            count: 1,
                            totalServings: 1
                        }
                    }
                },
                diapers: {
                    totalChanges: 3,
                    byType: { wet: 2, dirty: 1, both: 0, dry: 0 },
                },
                sleep: {
                    totalSessions: 2,
                    totalMinutes: 640,
                    byType: {
                        nap: { count: 1, totalMinutes: 80 },
                        nighttime: { count: 1, totalMinutes: 560 },
                    },
                },
            },
            timeline: [
                {
                    id: "meal-1400",
                    kind: "meal",
                    time: "2026-04-29T14:00:00",
                    type: "breastMilk",
                    amountMl: 60,
                },
                {
                    id: "sleep-1245",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-30T12:45:00",
                    endTime: "2026-04-30T13:25:00",
                },
                {
                    id: "meal-1230",
                    kind: "meal",
                    time: "2026-04-30T12:30:00",
                    type: "formula",
                    amountMl: 180,
                    notes: "Finished bottle calmly.",
                },
                {
                    id: "diaper-1145",
                    kind: "diaper",
                    time: "2026-04-30T11:45:00",
                    type: "wet",
                    notes: "Normal amount.",
                },
                {
                    id: "sleep-0930",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-30T09:30:00",
                    endTime: "2026-04-30T10:50:00",
                },
                {
                    id: "meal-0715",
                    kind: "meal",
                    time: "2026-04-30T07:15:00",
                    type: "breastfeed",
                    durationMinutes: 15,
                },
                {
                    id: "diaper-0650",
                    kind: "diaper",
                    time: "2026-04-30T06:50:00",
                    type: "dirty",
                    color: "brown",
                    notes: "Soft consistency.",
                },
                {
                    id: "sleep-0630",
                    kind: "sleep",
                    type: "nighttime",
                    startTime: "2026-04-29T21:10:00",
                    endTime: "2026-04-30T06:30:00",
                },
            ]
        },
        {
            date: "2026-04-29",
            summary: {
                meals: {
                    totalCount: 4,
                    byType: {
                        breastfeed: {
                            count: 2,
                            totalMinutes: 30,
                        },
                        breastMilk: {
                            count: 0,
                            totalAmountMl: 0,
                        },
                        formula: {
                            count: 1,
                            totalAmountMl: 180,
                        },
                        solid: {
                            count: 1,
                            totalServings: 1
                        }
                    }
                },
                diapers: {
                    totalChanges: 3,
                    byType: { wet: 2, dirty: 1, both: 0, dry: 0 },
                },
                sleep: {
                    totalSessions: 2,
                    totalMinutes: 640,
                    byType: {
                        nap: { count: 1, totalMinutes: 80 },
                        nighttime: { count: 1, totalMinutes: 560 },
                    },
                },
            },
            timeline: [
                {
                    id: "sleep-1245",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-29T12:45:00",
                    endTime: "2026-04-29T13:25:00",
                },
                {
                    id: "meal-1230",
                    kind: "meal",
                    time: "2026-04-29T12:30:00",
                    type: "formula",
                    amountMl: 180,
                    notes: "Finished bottle calmly.",
                },
                {
                    id: "diaper-1145",
                    kind: "diaper",
                    time: "2026-04-29T11:45:00",
                    type: "wet",
                    notes: "Normal amount.",
                },
                {
                    id: "sleep-0930",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-29T09:30:00",
                    endTime: "2026-04-29T10:50:00",
                },
                {
                    id: "meal-0715",
                    kind: "meal",
                    time: "2026-04-29T07:15:00",
                    type: "breastfeed",
                    durationMinutes: 15,
                },
                {
                    id: "diaper-0650",
                    kind: "diaper",
                    time: "2026-04-29T06:50:00",
                    type: "dirty",
                    color: "brown",
                    notes: "Soft consistency.",
                },
                {
                    id: "sleep-0630",
                    kind: "sleep",
                    type: "nighttime",
                    startTime: "2026-04-28T21:10:00",
                    endTime: "2026-04-29T06:30:00",
                },
            ]
        },
        {
            date: "2026-04-28",
            summary: {
                meals: {
                    totalCount: 4,
                    byType: {
                        breastfeed: {
                            count: 2,
                            totalMinutes: 30,
                        },
                        breastMilk: {
                            count: 0,
                            totalAmountMl: 0,
                        },
                        formula: {
                            count: 1,
                            totalAmountMl: 180,
                        },
                        solid: {
                            count: 1,
                            totalServings: 1
                        }
                    }
                },
                diapers: {
                    totalChanges: 3,
                    byType: { wet: 2, dirty: 1, both: 0, dry: 0 },
                },
                sleep: {
                    totalSessions: 2,
                    totalMinutes: 640,
                    byType: {
                        nap: { count: 1, totalMinutes: 80 },
                        nighttime: { count: 1, totalMinutes: 560 },
                    },
                },
            },
            timeline: [
                {
                    id: "sleep-1245",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-28T12:45:00",
                    endTime: "2026-04-28T13:25:00",
                },
                {
                    id: "meal-1230",
                    kind: "meal",
                    time: "2026-04-28T12:30:00",
                    type: "formula",
                    amountMl: 180,
                    notes: "Finished bottle calmly.",
                },
                {
                    id: "diaper-1145",
                    kind: "diaper",
                    time: "2026-04-28T11:45:00",
                    type: "wet",
                    notes: "Normal amount.",
                },
                {
                    id: "sleep-0930",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-28T09:30:00",
                    endTime: "2026-04-28T10:50:00",
                },
                {
                    id: "meal-0715",
                    kind: "meal",
                    time: "2026-04-28T07:15:00",
                    type: "breastfeed",
                    durationMinutes: 15,
                },
                {
                    id: "diaper-0650",
                    kind: "diaper",
                    time: "2026-04-28T06:50:00",
                    type: "dirty",
                    color: "brown",
                    notes: "Soft consistency.",
                },
                {
                    id: "sleep-0630",
                    kind: "sleep",
                    type: "nighttime",
                    startTime: "2026-04-27T21:10:00",
                    endTime: "2026-04-28T06:30:00",
                },
            ]
        },
        {
            date: "2026-04-27",
            summary: {
                meals: {
                    totalCount: 4,
                    byType: {
                        breastfeed: {
                            count: 2,
                            totalMinutes: 30,
                        },
                        breastMilk: {
                            count: 0,
                            totalAmountMl: 0,
                        },
                        formula: {
                            count: 1,
                            totalAmountMl: 180,
                        },
                        solid: {
                            count: 1,
                            totalServings: 1
                        }
                    }
                },
                diapers: {
                    totalChanges: 3,
                    byType: { wet: 2, dirty: 1, both: 0, dry: 0 },
                },
                sleep: {
                    totalSessions: 2,
                    totalMinutes: 640,
                    byType: {
                        nap: { count: 1, totalMinutes: 80 },
                        nighttime: { count: 1, totalMinutes: 560 },
                    },
                },
            },
            timeline: [
                {
                    id: "sleep-1245",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-27T12:45:00",
                    endTime: "2026-04-27T13:25:00",
                },
                {
                    id: "meal-1230",
                    kind: "meal",
                    time: "2026-04-27T12:30:00",
                    type: "formula",
                    amountMl: 180,
                    notes: "Finished bottle calmly.",
                },
                {
                    id: "diaper-1145",
                    kind: "diaper",
                    time: "2026-04-27T11:45:00",
                    type: "wet",
                    notes: "Normal amount.",
                },
                {
                    id: "sleep-0930",
                    kind: "sleep",
                    type: "nap",
                    startTime: "2026-04-27T09:30:00",
                    endTime: "2026-04-27T10:50:00",
                },
                {
                    id: "meal-0715",
                    kind: "meal",
                    time: "2026-04-27T07:15:00",
                    type: "breastfeed",
                    durationMinutes: 15,
                },
                {
                    id: "diaper-0650",
                    kind: "diaper",
                    time: "2026-04-27T06:50:00",
                    type: "dirty",
                    color: "brown",
                    notes: "Soft consistency.",
                },
                {
                    id: "sleep-0630",
                    kind: "sleep",
                    type: "nighttime",
                    startTime: "2026-04-26T21:10:00",
                    endTime: "2026-04-27T06:30:00",
                },
            ]
        }
    ]
} satisfies HomeMockApiResponse;
