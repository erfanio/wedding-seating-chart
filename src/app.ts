// ── Types ──

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  allergy: string;
}

interface SeatAssignment {
  tableId: string;
  seatNumber: number;
  guestId: string;
}

interface AppState {
  guests: Guest[];
  assignments: SeatAssignment[];
}

interface TableConfig {
  id: string;
  label: string;
  seats: number;
  type: "horizontal" | "vertical";
}

// ── Table configuration matching the floor plan ──

const TABLES: TableConfig[] = [
  { id: "table-1", label: "Table 1", seats: 10, type: "horizontal" },
  { id: "table-2", label: "Table 2", seats: 10, type: "horizontal" },
  { id: "table-3", label: "Table 3", seats: 16, type: "vertical" },
  { id: "table-4", label: "Table 4", seats: 14, type: "vertical" },
  { id: "table-5", label: "Table 5", seats: 14, type: "vertical" },
  { id: "table-6", label: "Table 6", seats: 16, type: "vertical" },
];

// ── State ──

const STORAGE_KEY = "wedding-seating-state";

let state: AppState = { guests: [], assignments: [] };

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = { guests: [], assignments: [] };
    }
  }
}

// ── Helpers ──

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getAssignment(tableId: string, seatNumber: number): SeatAssignment | undefined {
  return state.assignments.find(
    (a) => a.tableId === tableId && a.seatNumber === seatNumber
  );
}

function getGuestAssignment(guestId: string): SeatAssignment | undefined {
  return state.assignments.find((a) => a.guestId === guestId);
}

function getGuest(guestId: string): Guest | undefined {
  return state.guests.find((g) => g.id === guestId);
}

function assignGuest(tableId: string, seatNumber: number, guestId: string): void {
  // Remove any existing assignment for this guest
  state.assignments = state.assignments.filter((a) => a.guestId !== guestId);
  // Remove any existing assignment for this seat
  state.assignments = state.assignments.filter(
    (a) => !(a.tableId === tableId && a.seatNumber === seatNumber)
  );
  state.assignments.push({ tableId, seatNumber, guestId });
  saveState();
}

function unassignSeat(tableId: string, seatNumber: number): void {
  state.assignments = state.assignments.filter(
    (a) => !(a.tableId === tableId && a.seatNumber === seatNumber)
  );
  saveState();
}

function getUnassignedGuests(): Guest[] {
  const assignedIds = new Set(state.assignments.map((a) => a.guestId));
  return state.guests.filter((g) => !assignedIds.has(g.id));
}

// ── Seat rendering ──

function createSeatElement(tableId: string, seatNumber: number): HTMLElement {
  const seat = document.createElement("div");
  seat.className = "seat empty";
  seat.dataset.table = tableId;
  seat.dataset.seat = String(seatNumber);
  seat.textContent = String(seatNumber);

  const assignment = getAssignment(tableId, seatNumber);
  if (assignment) {
    const guest = getGuest(assignment.guestId);
    if (guest) {
      seat.className = "seat assigned";
      if (guest.allergy) seat.classList.add("has-allergy");
      seat.draggable = true;
      seat.textContent = `${guest.firstName} ${guest.lastName.charAt(0)}.`;
      const allergyTip = guest.allergy ? `\nAllergy: ${guest.allergy}` : "";
      seat.title = `${guest.firstName} ${guest.lastName}${allergyTip}\nDrag to move · Click to unassign`;

      seat.addEventListener("dragstart", (e) => {
        e.dataTransfer!.setData("text/plain", guest.id);
        e.dataTransfer!.effectAllowed = "move";
        seat.classList.add("dragging");
      });

      seat.addEventListener("dragend", () => {
        seat.classList.remove("dragging");
      });
    }
  }

  // Drop target
  seat.addEventListener("dragover", (e) => {
    e.preventDefault();
    seat.classList.add("drag-over");
  });

  seat.addEventListener("dragleave", () => {
    seat.classList.remove("drag-over");
  });

  seat.addEventListener("drop", (e) => {
    e.preventDefault();
    seat.classList.remove("drag-over");
    const guestId = e.dataTransfer?.getData("text/plain");
    if (guestId) {
      // Capture state before any mutation
      const existingGuestId = getAssignment(tableId, seatNumber)?.guestId;
      const draggedFrom = getGuestAssignment(guestId);
      const fromTableId = draggedFrom?.tableId;
      const fromSeat = draggedFrom?.seatNumber;

      // Remove both assignments
      state.assignments = state.assignments.filter(
        (a) => a.guestId !== guestId && !(a.tableId === tableId && a.seatNumber === seatNumber)
      );

      // Place dragged guest in this seat
      state.assignments.push({ tableId, seatNumber, guestId });

      // Swap: put displaced guest in the seat the dragged guest came from
      if (existingGuestId && existingGuestId !== guestId && fromTableId && fromSeat !== undefined) {
        state.assignments.push({ tableId: fromTableId, seatNumber: fromSeat, guestId: existingGuestId });
      }

      saveState();
      render();
    }
  });

  // Click to unassign
  seat.addEventListener("click", () => {
    if (getAssignment(tableId, seatNumber)) {
      unassignSeat(tableId, seatNumber);
      render();
    }
  });

  return seat;
}

// ── Build table seats into the DOM ──

function buildTableSeats(): void {
  for (const table of TABLES) {
    const el = document.getElementById(table.id);
    if (!el) continue;

    if (table.type === "horizontal") {
      // 10 seats: 1-4 top, 5 right, 6-9 bottom, 10 left
      const topContainer = el.querySelector(".top-seats")!;
      const bottomContainer = el.querySelector(".bottom-seats")!;
      const leftContainer = el.querySelector(".left-seat")!;
      const rightContainer = el.querySelector(".right-seat")!;

      topContainer.innerHTML = "";
      bottomContainer.innerHTML = "";
      leftContainer.innerHTML = "";
      rightContainer.innerHTML = "";

      for (let i = 1; i <= 4; i++) {
        topContainer.appendChild(createSeatElement(table.id, i));
      }
      rightContainer.appendChild(createSeatElement(table.id, 5));
      for (let i = 9; i >= 6; i--) {
        bottomContainer.appendChild(createSeatElement(table.id, i));
      }
      leftContainer.appendChild(createSeatElement(table.id, 10));
    } else {
      // Vertical: seats split left/right
      const leftContainer = el.querySelector(".left-seats")!;
      const rightContainer = el.querySelector(".right-seats")!;

      leftContainer.innerHTML = "";
      rightContainer.innerHTML = "";

      const perSide = table.seats / 2;

      // Right side: seats 1..N (top to bottom)
      for (let i = 1; i <= perSide; i++) {
        rightContainer.appendChild(createSeatElement(table.id, i));
      }

      // Left side: seats N+1..total (bottom to top, so numbered top to bottom descending)
      for (let i = table.seats; i > perSide; i--) {
        leftContainer.appendChild(createSeatElement(table.id, i));
      }

      // Set table height based on seat count (34px seat + 2px gap)
      const height = perSide * 36 + 4;
      el.style.height = `${height}px`;
    }
  }
}

// ── Guest list rendering ──

function renderGuestList(): void {
  const listEl = document.getElementById("guest-list")!;
  const countEl = document.getElementById("guest-count")!;
  listEl.innerHTML = "";

  const unassigned = getUnassignedGuests();
  const totalAssigned = state.assignments.length;

  countEl.textContent = `${totalAssigned} assigned / ${state.guests.length} total`;

  for (const guest of unassigned) {
    const item = document.createElement("div");
    item.className = "guest-item";
    if (guest.allergy) item.classList.add("has-allergy");
    item.draggable = true;
    item.textContent = `${guest.firstName} ${guest.lastName}`;
    if (guest.allergy) item.title = `Allergy: ${guest.allergy}`;
    item.dataset.guestId = guest.id;

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer!.setData("text/plain", guest.id);
      e.dataTransfer!.effectAllowed = "move";
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    listEl.appendChild(item);
  }
}

// ── Full render ──

function render(): void {
  buildTableSeats();
  renderGuestList();
}

// ── Import names ──

function findTableByLabel(label: string): TableConfig | undefined {
  return TABLES.find((t) => t.label.toLowerCase() === label.toLowerCase());
}

function detectExportFormat(lines: string[]): boolean {
  // Check if first data row looks like "Table N\t<number>\t..."
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes("table") && firstLine.includes("seat")) return true;
  // Check second line if first is a header
  if (lines.length > 1) {
    const parts = lines[1].split(/\t/);
    if (parts.length >= 4 && findTableByLabel(parts[0]) && !isNaN(Number(parts[1]))) {
      return true;
    }
  }
  return false;
}

function importNames(): void {
  const textarea = document.getElementById("name-input") as HTMLTextAreaElement;
  const text = textarea.value.trim();
  if (!text) return;

  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return;

  const isExport = detectExportFormat(lines);
  let startIdx = 0;

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  if (isExport) {
    if (firstLine.includes("table") && firstLine.includes("seat")) {
      startIdx = 1;
    }
  } else if (firstLine.includes("first") && firstLine.includes("last")) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\t/);

    if (isExport && parts.length >= 4) {
      // Export format: Table, Seat, First Name, Last Name, Allergy
      const tableLabel = parts[0].trim();
      const seatNumber = parseInt(parts[1].trim(), 10);
      const firstName = parts[2].trim();
      const lastName = parts[3].trim();
      const allergy = (parts[4] || "").trim();

      if (!firstName && !lastName) continue;

      const guest: Guest = { id: generateId(), firstName, lastName, allergy };
      state.guests.push(guest);

      const table = findTableByLabel(tableLabel);
      if (table && !isNaN(seatNumber)) {
        // Remove any existing assignment for this seat
        state.assignments = state.assignments.filter(
          (a) => !(a.tableId === table.id && a.seatNumber === seatNumber)
        );
        state.assignments.push({ tableId: table.id, seatNumber, guestId: guest.id });
      }
    } else if (parts.length >= 2) {
      // Simple format: First Name, Last Name, Allergy
      const firstName = parts[0].trim();
      const lastName = parts[1].trim();
      const allergy = (parts[2] || "").trim();
      if (firstName || lastName) {
        state.guests.push({ id: generateId(), firstName, lastName, allergy });
      }
    } else {
      const firstName = parts[0].trim();
      if (firstName) {
        state.guests.push({ id: generateId(), firstName, lastName: "", allergy: "" });
      }
    }
  }

  saveState();
  textarea.value = "";
  render();
}

// ── Export ──

function exportToClipboard(): void {
  const lines: string[] = ["Table\tSeat\tFirst Name\tLast Name\tAllergy"];

  // Sort by table then seat number
  const sorted = [...state.assignments].sort((a, b) => {
    if (a.tableId !== b.tableId) return a.tableId.localeCompare(b.tableId);
    return a.seatNumber - b.seatNumber;
  });

  for (const assignment of sorted) {
    const guest = getGuest(assignment.guestId);
    if (!guest) continue;
    const tableConfig = TABLES.find((t) => t.id === assignment.tableId);
    const tableName = tableConfig?.label ?? assignment.tableId;
    lines.push(
      `${tableName}\t${assignment.seatNumber}\t${guest.firstName}\t${guest.lastName}\t${guest.allergy}`
    );
  }

  // Unassigned guests with empty table/seat
  for (const guest of getUnassignedGuests()) {
    lines.push(`\t\t${guest.firstName}\t${guest.lastName}\t${guest.allergy}`);
  }

  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    const btn = document.getElementById("export-btn")!;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy to Clipboard";
      btn.classList.remove("copied");
    }, 2000);
  });
}

// ── Clear all ──

function clearAll(): void {
  if (!confirm("Remove all guests and assignments?")) return;
  state = { guests: [], assignments: [] };
  saveState();
  render();
}

// ── Init ──

function init(): void {
  loadState();

  document.getElementById("import-btn")!.addEventListener("click", importNames);
  document.getElementById("export-btn")!.addEventListener("click", exportToClipboard);
  document.getElementById("clear-btn")!.addEventListener("click", clearAll);

  render();
}

init();
