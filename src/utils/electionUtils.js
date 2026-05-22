export const ELECTION_ID = "student-parliament-2026";
export const ELECTION_TITLE = "Students' Parliament Election - 2026";
export const ELECTION_ORGANIZER = "Board of Prefects - Kilinochchi Central College";
export const ELECTION_POWERED_BY = "Powered by Board of Prefects - Kilinochchi Central College";
export const ELECTION_LOCAL_KEY = `kcc-election-${ELECTION_ID}`;
export const CANDIDATE_COUNT = 150;

export const createDefaultCandidates = () =>
  Array.from({ length: CANDIDATE_COUNT }, (_, index) => {
    const number = index + 1;
    return {
      number,
      label: `Candidate ${String(number).padStart(3, "0")}`,
      votes: 0,
    };
  });

export const createInitialElectionState = () => ({
  id: ELECTION_ID,
  title: ELECTION_TITLE,
  organizer: ELECTION_ORGANIZER,
  candidateCount: CANDIDATE_COUNT,
  candidates: createDefaultCandidates(),
  rejectedVotes: 0,
  entries: [],
  createdAtText: new Date().toISOString(),
  updatedAtText: new Date().toISOString(),
});

export const normalizeElectionState = (rawState = {}) => {
  const rawCandidates = Array.isArray(rawState.candidates) ? rawState.candidates : [];
  const candidateMap = new Map(
    rawCandidates.map((candidate) => [
      Number(candidate.number),
      {
        number: Number(candidate.number),
        label: String(candidate.label || "").trim(),
        votes: Number(candidate.votes || 0),
      },
    ])
  );

  return {
    ...createInitialElectionState(),
    ...rawState,
    candidates: createDefaultCandidates().map((candidate) => {
      const existing = candidateMap.get(candidate.number);
      return {
        ...candidate,
        label: existing?.label || candidate.label,
        votes: Math.max(0, Number(existing?.votes || 0)),
      };
    }),
    rejectedVotes: Math.max(0, Number(rawState.rejectedVotes || 0)),
    entries: Array.isArray(rawState.entries) ? rawState.entries.slice(0, 250) : [],
  };
};

export const getElectionTotals = (state) => {
  const candidates = state?.candidates || [];
  const validVotes = candidates.reduce((sum, candidate) => sum + Number(candidate.votes || 0), 0);
  const rejectedVotes = Number(state?.rejectedVotes || 0);
  const totalVotes = validVotes + rejectedVotes;
  const rankedCandidates = [...candidates].sort((a, b) => {
    const voteDiff = Number(b.votes || 0) - Number(a.votes || 0);
    if (voteDiff !== 0) return voteDiff;
    return Number(a.number) - Number(b.number);
  });
  const leaderVotes = Number(rankedCandidates[0]?.votes || 0);
  const leaders = leaderVotes > 0 ? rankedCandidates.filter((candidate) => candidate.votes === leaderVotes) : [];

  return {
    validVotes,
    rejectedVotes,
    totalVotes,
    rankedCandidates,
    leaders,
    leaderVotes,
  };
};

export const formatCandidateNumber = (number) => String(number).padStart(3, "0");

export const parseVoteInput = (value) => {
  const cleaned = String(value || "").trim().toUpperCase();
  if (!cleaned) return { type: "empty" };
  if (["R", "REJECT", "REJECTED", "INVALID", "X"].includes(cleaned)) return { type: "rejected" };
  if (["U", "UNDO"].includes(cleaned)) return { type: "undo" };

  const number = Number(cleaned);
  if (!Number.isInteger(number) || number < 1 || number > CANDIDATE_COUNT) {
    return { type: "invalid", message: `Enter a candidate number from 1 to ${CANDIDATE_COUNT}, or R for rejected.` };
  }

  return { type: "candidate", number };
};

export const makeEntry = ({ type, candidateNumber = null, label = "", operatorName = "" }) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  candidateNumber,
  label,
  operatorName,
  createdAtText: new Date().toISOString(),
});

export const applyVoteEntry = (state, entry) => {
  const current = normalizeElectionState(state);
  const next = {
    ...current,
    candidates: current.candidates.map((candidate) =>
      entry.type === "candidate" && candidate.number === entry.candidateNumber
        ? { ...candidate, votes: Number(candidate.votes || 0) + 1 }
        : candidate
    ),
    rejectedVotes: entry.type === "rejected" ? Number(current.rejectedVotes || 0) + 1 : Number(current.rejectedVotes || 0),
    entries: [entry, ...(current.entries || [])].slice(0, 250),
    updatedAtText: new Date().toISOString(),
  };

  return next;
};

export const undoLastEntry = (state) => {
  const current = normalizeElectionState(state);
  const [lastEntry, ...rest] = current.entries || [];
  if (!lastEntry) return { state: current, undone: null };

  const next = {
    ...current,
    candidates: current.candidates.map((candidate) => {
      if (lastEntry.type !== "candidate" || candidate.number !== lastEntry.candidateNumber) return candidate;
      return { ...candidate, votes: Math.max(0, Number(candidate.votes || 0) - 1) };
    }),
    rejectedVotes:
      lastEntry.type === "rejected" ? Math.max(0, Number(current.rejectedVotes || 0) - 1) : Number(current.rejectedVotes || 0),
    entries: rest,
    updatedAtText: new Date().toISOString(),
  };

  return { state: next, undone: lastEntry };
};

export const updateCandidateLabels = (state, labelText) => {
  const labels = new Map();

  String(labelText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [numberPart, ...nameParts] = line.split(",");
      const number = Number(numberPart.trim());
      const label = nameParts.join(",").trim();
      if (Number.isInteger(number) && number >= 1 && number <= CANDIDATE_COUNT && label) {
        labels.set(number, label);
      }
    });

  const current = normalizeElectionState(state);
  return {
    ...current,
    candidates: current.candidates.map((candidate) => ({
      ...candidate,
      label: labels.get(candidate.number) || candidate.label,
    })),
    updatedAtText: new Date().toISOString(),
  };
};

export const parseManualCountRows = (value) => {
  const counts = new Map();
  const errors = [];
  let rejectedVotes = null;

  String(value || "")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed
        .split(/[,\t:| ]+/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length < 2) {
        errors.push(`Line ${index + 1}: enter candidate number and votes.`);
        return;
      }

      const [candidatePart, votePart] = parts;
      const votes = Number(votePart);

      if (!Number.isInteger(votes) || votes < 0) {
        errors.push(`Line ${index + 1}: votes must be 0 or more.`);
        return;
      }

      if (["R", "REJECT", "REJECTED", "INVALID"].includes(candidatePart.toUpperCase())) {
        rejectedVotes = votes;
        return;
      }

      const candidateNumber = Number(candidatePart);
      if (!Number.isInteger(candidateNumber) || candidateNumber < 1 || candidateNumber > CANDIDATE_COUNT) {
        errors.push(`Line ${index + 1}: candidate must be 1 to ${CANDIDATE_COUNT}, or R for rejected.`);
        return;
      }

      counts.set(candidateNumber, votes);
    });

  return {
    counts,
    errors,
    rejectedVotes,
  };
};

export const applyManualElectionCounts = (state, counts, rejectedVotes = 0) => {
  const current = normalizeElectionState(state);
  return {
    ...current,
    candidates: current.candidates.map((candidate) => ({
      ...candidate,
      votes: Math.max(0, Number(counts.get(candidate.number) || 0)),
    })),
    rejectedVotes: Math.max(0, Number(rejectedVotes || 0)),
    entries: [],
    updatedAtText: new Date().toISOString(),
  };
};

export const electionToCsv = (state) => {
  const totals = getElectionTotals(state);
  const rows = [
    ["Election", ELECTION_TITLE],
    ["Organizer", ELECTION_ORGANIZER],
    ["Generated At", new Date().toLocaleString()],
    [],
    ["Total Votes", totals.totalVotes],
    ["Valid Votes", totals.validVotes],
    ["Rejected Votes", totals.rejectedVotes],
    [],
    ["Rank", "Candidate Number", "Candidate Name", "Votes"],
    ...totals.rankedCandidates.map((candidate, index) => [
      index + 1,
      formatCandidateNumber(candidate.number),
      candidate.label,
      candidate.votes,
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
};
