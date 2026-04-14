let dirHandle = null,
    decks = [],
    currentDeck = null,
    fileMode = false,
    uploadedFiles = {};
let cards = [];
let activeFilters = {
    elements: new Set(),
    classes: new Set(),
    types: new Set(),
    subtypes: new Set()
};
document.querySelector('.filter-group[data-type="subtypes"]').classList.add('scrollable');
const toggleDark = document.getElementById("toggleDark");
toggleDark.onclick = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
    updateDarkButton();
};

function updateDarkButton() {
    toggleDark.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}
const subtypeInput = document.getElementById("subtypeSearch");
subtypeInput.addEventListener("input", () => {
    const query = subtypeInput.value.toLowerCase();

    Array.from(subtypeChips.children).forEach(chip => {
        if (chip.textContent.toLowerCase().includes(query)) {
            chip.style.display = "inline-block";
        } else {
            chip.style.display = "none";
        }
    });
});

function HandleBrowseClick() {
    var fileinput = document.getElementById("fileInput");
    fileinput.click();
}

function Handlechange() {
    var fileinput = document.getElementById("fileInput");
    var textinput = document.getElementById("filename");
    textinput.value = fileinput.value;
}

function setDeckTitle(deckName) {
    if (deckName) {
        document.title = `${deckName} - GAS DB`;
    } else {
        document.title = "GAS DB";
    }
}
const slider = document.getElementById("formatSlider");
const track = slider.querySelector(".segmented-track");
const buttons = slider.querySelectorAll("button");

let formatFilter = "ANYWHERE";

function updateSlider(activeBtn) {
    track.style.width = activeBtn.offsetWidth + "px";
    track.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}
buttons.forEach(btn => {
    btn.onclick = () => {
        formatFilter = btn.dataset.format;
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateSlider(btn);
        searchCards();
    };
});
window.addEventListener("load", () => {
    const active = slider.querySelector(".active");
    if (active) updateSlider(active);
});

function isLegalIn(card, format) {
    if (!card.legality) return true;

    const f = card.legality[format];
    if (!f) return true;

    return f.limit !== 0;
}


let shiftHeld = false;
document.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
        shiftHeld = true;
        document.querySelectorAll(".card-tile:hover")
            .forEach(el => el.classList.add("zoom"));
    }
});
document.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
        shiftHeld = false;
        removeAllZooms();
    }
});

function removeAllZooms() {
    document.querySelectorAll(".card-tile.zoom")
        .forEach(el => el.classList.remove("zoom"));
}

function buildFilterChips() {
    const groups = {
        elements: new Set(),
        classes: new Set(),
        types: new Set(),
        subtypes: new Set()
    };

    cards.forEach(c => {
        c.elements.forEach(x => groups.elements.add(x));
        c.classes.forEach(x => groups.classes.add(x));
        c.types.forEach(x => groups.types.add(x));
        c.subtypes.forEach(x => groups.subtypes.add(x));
    });

    Object.keys(groups).forEach(type => {
        const container = document.querySelector(`.filter-group[data-type="${type}"]`);
        container.innerHTML = "";

        Array.from(groups[type])
            .sort((a, b) => a.localeCompare(b))
            .forEach(value => {
                const chip = document.createElement("div");
                chip.className = "chip";
                chip.textContent = value;

                chip.onclick = () => {
                    const val = value.toLowerCase();
                    if (activeFilters[type].has(val)) {
                        activeFilters[type].delete(val);
                        chip.classList.remove("active");
                    } else {
                        activeFilters[type].add(val);
                        chip.classList.add("active");
                    }
                    searchCards();
                };
                container.appendChild(chip);
            });
    });
}

function norm(c) {
    let memory = null,
        reserve = null;

    if (c.cost?.type && c.cost?.value != null) {
        const val = Number(c.cost.value);
        if (c.cost.type.toLowerCase() === "memory") {
            memory = val;
        } else if (c.cost.type.toLowerCase() === "reserve") {
            reserve = val;
        }
    }

    return {
        name: c.name || c.cardName,
		editions: c.editions || [],
        costType: c.cost?.type || "reserve",
        elements: c.elements || [],
        classes: c.classes || [],
        types: c.types || [],
        subtypes: c.subtypes || [],
        memory,
        reserve,
        power: c.power ?? null,
        life: (c.life ?? c.durability) ?? null,
        legality: c.legality || null,
		effect_raw: c.effect_raw || []
    };
}

async function loadCardDatabase() {
    const res = await fetch("GrandArchiveCards.json");
    const data = await res.json();
    const raw = Array.isArray(data) ? data : data.cards || Object.values(data).flat();
    cards = raw.map(norm);
}

function matchArrayFilter(values, filter) {
    if (!filter.length) return true;
    return filter.every(f => values.includes(f));
}

function searchCards() {
    const q = searchInput.value.toLowerCase();
	const fEffect = normalizeText(filterEffect.value);
    const fElements = [...activeFilters.elements].map(x => x.toLowerCase());
    const fClasses = [...activeFilters.classes].map(x => x.toLowerCase());
    const fTypes = [...activeFilters.types].map(x => x.toLowerCase());
    const fSubtypes = [...activeFilters.subtypes].map(x => x.toLowerCase());
    const fMemory = filterMemory.value === "" ? null : Number(filterMemory.value);
    const fReserve = filterReserve.value === "" ? null : Number(filterReserve.value);
    const fPower = filterPower.value === "" ? null : Number(filterPower.value);
    const fLife = filterLife.value === "" ? null : Number(filterLife.value);
    const res = document.getElementById("searchResults");
    res.innerHTML = "";
    const noFilters = !q &&
		!fEffect &&
        !fElements.length &&
        !fClasses.length &&
        !fTypes.length &&
        !fSubtypes.length &&
        !filterMemory.value &&
        !filterReserve.value &&
        !filterPower.value &&
        !filterLife.value;

    if (noFilters) {
        res.innerHTML = "";
        return;
    }

    const results = cards.filter(c => {
        if (q && !c.name.toLowerCase().includes(q)) return false;
		if (fEffect && !(normalizeText(c.effect_raw)).includes(fEffect)) return false;
        if (!matchArrayFilter(c.elements.map(x => x.toLowerCase()), fElements)) return false;
        if (!matchArrayFilter(c.classes.map(x => x.toLowerCase()), fClasses)) return false;
        if (!matchArrayFilter(c.types.map(x => x.toLowerCase()), fTypes)) return false;
        if (!matchArrayFilter(c.subtypes.map(x => x.toLowerCase()), fSubtypes)) return false;
        if (fMemory !== null && c.memory != fMemory) return false;
        if (fReserve !== null && c.reserve != fReserve) return false;
        if (fPower !== null && c.power !== fPower) return false;
        if (fLife !== null && c.life !== fLife) return false;
        if (formatFilter !== "ANYWHERE") {
            if (!isLegalIn(c, formatFilter)) return false;
        }
        if (formatFilter === "ANYWHERE") {
            const legalAnywhere =
                isLegalIn(c, "STANDARD") ||
                isLegalIn(c, "PANTHEON") ||
                isLegalIn(c, "DRAFT");
            if (!legalAnywhere) return false;
        } else {
            if (!isLegalIn(c, formatFilter)) return false;
        }
        return true;
    }).slice(0, 60);

    results.forEach(card => {
        const d = document.createElement("div");
        d.className = "card-tile";
        d.draggable = true;
        d.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", card.name);
        };
        d.addEventListener("mouseenter", () => {
            if (shiftHeld) {
                d.classList.add("zoom");
            }
        });
        d.addEventListener("mouseleave", () => {
            d.classList.remove("zoom");
        });
		const imgPath = card.editions?.[0]?.image || "";
		d.innerHTML = `<img src="http://api.gatcg.com/` + `${imgPath}"/>`;
        d.onclick = () => addCard(card.name);
        res.appendChild(d);
    });
}

function getCardImage(cardData, editionName) {
    if (!cardData?.editions?.length) return "";

    if (!editionName) return cardData.editions[0].image;

    const lower = editionName.toLowerCase();

    const setMatch = cardData.editions.find(e =>
        e.set?.name?.toLowerCase() === lower
    );

    if (setMatch) return setMatch.image;

    const partialMatch = cardData.editions.find(e =>
        lower.includes(e.set?.name?.toLowerCase())
    );

    if (partialMatch) return partialMatch.image;

    const configMatch = editionName.match(/\((.*?)\)/);
    if (configMatch) {
        const config = configMatch[1].toLowerCase();

        const configEdition = cardData.editions.find(e =>
            (e.configuration || "").toLowerCase() === config
        );

        if (configEdition) return configEdition.image;
    }

    return cardData.editions[0].image;
}

function parseDeckText(t) {
    const r = {
        material: [],
        main: [],
        sideboard: [],
		tokenedit: []
    };

    let s = null;

    t.split("\n").forEach(l => {
        l = l.trim();
        if (!l) return;

        if (l.startsWith("#")) {
            if (l.toLowerCase().includes("material")) s = "material";
            else if (l.toLowerCase().includes("main")) s = "main";
            else if (l.toLowerCase().includes("side")) s = "sideboard";
            else if (l.toLowerCase().includes("token")) s = "tokenedit";
            return;
        }

        // NEW: parse edition
        const m = l.match(/(\d+)\s+(.+?)(?:\s+\[Edition:\s*(.+?)\])?$/);

        if (m && s) {
            r[s].push({
                count: +m[1],
                name: m[2],
                edition: m[3] || null
            });
        }
    });

    return r;
}

function serializeDeck(p) {
    const clean = (list) => list.filter(c => c && c.name && c.count > 0);

    const f = (title, cards) => {
        const valid = clean(cards);
        if (!valid.length) return "";

        return `# ${title}\n` + valid.map(c => {
            const editionPart = c.edition ? ` [Edition: ${c.edition}]` : "";
            return `${c.count} ${c.name}${editionPart}`;
        }).join("\n") + "\n\n";
    };

    return (
        f("Material Deck", p.material) +
        f("Main Deck", p.main) +
        f("Sideboard", p.sideboard) +
		f("Token Edition", p.tokenedit)
    ).trim();
}

function renderDeckList() {
    const c = document.getElementById("deckList");
    c.innerHTML = "";
    decks.forEach(d => {
        const div = document.createElement("div");
        div.className = "deck";
        const nameSpan = document.createElement("span");
        nameSpan.className = "deck-name";
        nameSpan.textContent = d.name;
        div.onclick = () => {
            currentDeck = d;
            deckTitle.textContent = d.name;
            renderSections();
            setDeckTitle(d.name);
        };

        const btnWrap = document.createElement("div");
        btnWrap.className = "deck-actions";

        const renameBtn = document.createElement("button");
        renameBtn.textContent = "R";
        renameBtn.title = "Rename";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt("New name:", d.name);
            if (newName) {
                d.name = newName;
                renderDeckList();
            }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "D";
        deleteBtn.title = "Delete";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm("Delete deck?")) {
                decks = decks.filter(x => x.id !== d.id);
                if (currentDeck?.id === d.id) {
                    currentDeck = null;
                    deckTitle.textContent = "No deck selected";
                    setDeckTitle(null);
                    document.getElementById("sections").innerHTML = "";
                }
                renderDeckList();
            }

        };

        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(deleteBtn);
        div.appendChild(nameSpan);
        div.appendChild(btnWrap);
        c.appendChild(div);
    });
}

function getCount(list) {
    return list.reduce((a, b) => a + b.count, 0);
}

function createZone(name, list) {
    const zoneWrap = document.createElement("div");
    zoneWrap.className = "section";
    zoneWrap.innerHTML = `<h3>${name} (${getCount(list)})</h3>`;

    const zone = document.createElement("div");
    zone.className = "zone";

    zone.ondragover = e => e.preventDefault();

    zone.ondrop = e => {
        e.preventDefault();

        const cardName = e.dataTransfer.getData("text/plain");
        const edition = e.dataTransfer.getData("edition") || null;
        const fromZone = e.dataTransfer.getData("fromZone");
        const toZone = name.toLowerCase();

        if (fromZone && fromZone !== toZone) {
            moveCard(cardName, fromZone, toZone, edition);
        } else {
            addCard(cardName, toZone, edition);
        }
    };

    list.forEach((card, i) => {
        const data = cards.find(c => c.name === card.name) || {
            image: "",
            name: card.name
        };

        const tile = document.createElement("div");
        tile.className = "card-tile";
        tile.draggable = true;

        tile.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", card.name);
            e.dataTransfer.setData("fromZone", name.toLowerCase());
            e.dataTransfer.setData("edition", card.edition || "");
        };

        tile.addEventListener("mouseenter", () => {
            if (shiftHeld) tile.classList.add("zoom");
        });

        tile.addEventListener("mouseleave", () => {
            tile.classList.remove("zoom");
        });

        const img = document.createElement("img");
		const imgPath = getCardImage(data, card.edition);
		img.src = imgPath ? "http://api.gatcg.com/" + imgPath : "";

        const count = document.createElement("div");
        count.className = "card-count";
        count.textContent = card.count;

        const controls = document.createElement("div");
        controls.className = "card-controls";

        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.onclick = () => {
            card.count++;
            renderSections();
        };

        const minus = document.createElement("button");
        minus.textContent = "-";
        minus.onclick = () => {
            card.count--;
            if (card.count <= 0) list.splice(i, 1);
            renderSections();
        };

        controls.appendChild(plus);
        controls.appendChild(minus);

        tile.appendChild(img);
        tile.appendChild(count);
        tile.appendChild(controls);

        zone.appendChild(tile);
    });

    zoneWrap.appendChild(zone);
    return zoneWrap;
}

function renderSections() {
    const c = document.getElementById("sections");
    c.innerHTML = "";
    c.appendChild(createZone("Material", currentDeck.parsed.material));
    c.appendChild(createZone("Main", currentDeck.parsed.main));
    c.appendChild(createZone("Sideboard", currentDeck.parsed.sideboard));
}

function normalizeText(str) {
    if (!str) return "";

    if (Array.isArray(str)) {
        str = str.join(" ");
    }

    if (typeof str === "object") {
        str = JSON.stringify(str);
    }

    return String(str)
        .toLowerCase()
        .replace(/\n+/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function addCard(name, forcedSection = null, edition = null) {
    if (!currentDeck || !name) return;

    const card = cards.find(c => c.name === name);
    let section = forcedSection || (card?.costType === "memory" ? "material" : "main");

    const list = currentDeck.parsed[section];

    const ex = list.find(c => c.name === name);

    if (ex) {
        ex.count = Number(ex.count) || 0;
        ex.count++;
    } else {
        list.push({
            name: String(name),
            edition,
            count: 1
        });
    }

    renderSections();
}

function moveCard(name, from, to, edition = null) {
    if (!name || !currentDeck) return;

    const fromList = currentDeck.parsed[from];
    const toList = currentDeck.parsed[to];

    const card = fromList.find(c => c.name === name && c.edition === edition);
    if (!card) return;

    card.count = Number(card.count) || 0;
    card.count--;

    if (card.count <= 0) {
        const index = fromList.indexOf(card);
        if (index !== -1) fromList.splice(index, 1);
    }

    const existing = toList.find(c => c.name === name && c.edition === edition);

    if (existing) {
        existing.count = Number(existing.count) || 0;
        existing.count++;
    } else {
        toList.push({
            name: String(name),
            edition,
            count: 1
        });
    }

    renderSections();
}

async function saveDeckFile() {
    const txt = serializeDeck(currentDeck.parsed);
    if (!fileMode && dirHandle) {
        const h = await dirHandle.getFileHandle(currentDeck.id + ".txt", {
            create: true
        });
        const w = await h.createWritable();
        await w.write(txt);
        await w.close();
        alert("Saved!");
    } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([txt]));
        a.download = currentDeck.id + ".txt";
        a.click();
    }
}

searchInput.oninput = searchCards;
filterEffect.oninput = searchCards;
filterMemory.oninput = searchCards;
filterReserve.oninput = searchCards;
filterPower.oninput = searchCards;
filterLife.oninput = searchCards;

openFolder.onclick = async () => {
    if (!window.showDirectoryPicker) return alert("Your browser is not compatible.\nUse the 'Upload deck files' button instead.");
    fileMode = false;
    dirHandle = await window.showDirectoryPicker();
    await loadDecksFromFolder();
};
fileInput.onchange = async e => {
    fileMode = true;
    await loadDecksFromFiles(e.target.files);
};
saveDeck.onclick = saveDeckFile;

document.getElementById("newDeck").onclick = () => {
    const name = prompt("Deck name?");
    if (!name) return;
    const id = crypto.randomUUID().replace(/-/g, "");
    const newDeckObj = {
        id,
        name,
        parsed: {
            material: [],
            main: [],
            sideboard: [],
			tokenedit: []
        }
    };
    decks.push(newDeckObj);
    renderDeckList();
};

document.getElementById("downloadIndex").onclick = () => {
    const index = {
        decks: decks.map(d => ({
            id: d.id,
            name: d.name,
            updatedUtcTicks: Date.now()
        }))
    };
    const blob = new Blob([JSON.stringify(index, null, 2)], {
        type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "deck-index.json";
    a.click();
};
async function loadDecksFromFolder() {
    const f = await (await dirHandle.getFileHandle("deck-index.json")).getFile();
    const j = JSON.parse(await f.text());
    decks = [];
    for (const d of j.decks) {
        try {
            const txt = await (await (await dirHandle.getFileHandle(d.id + ".txt")).getFile()).text();
            decks.push({
                id: d.id,
                name: d.name,
                parsed: parseDeckText(txt)
            });
        } catch {}
    }
    renderDeckList();
}

async function loadDecksFromFiles(fl) {
    uploadedFiles = {};
    for (const f of fl) uploadedFiles[f.name] = f;
    const j = JSON.parse(await uploadedFiles["deck-index.json"].text());
    decks = [];
    for (const d of j.decks) {
        try {
            const txt = await uploadedFiles[d.id + ".txt"].text();
            decks.push({
                id: d.id,
                name: d.name,
                parsed: parseDeckText(txt)
            });
        } catch {}
    }
    renderDeckList();
}
async function init() {
    await loadCardDatabase();
    buildFilterChips();
    updateDarkButton();
}

init();
if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
}