import { useEffect, useMemo, useState } from "react";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { useRef } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import "./App.css";

const fallbackOptions = ["검색 결과 1", "검색 결과 2", "검색 결과 3"];
const bingoLinePatterns = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const initialBoards = [
  {
    id: "seed-1",
    title: "덕후의 취향 빙고 #1",
    owner: "duckA",
    isPublic: true,
    views: 0,
    createdAt: "2026-05-20",
    cells: [
      { title: "Berserk", searchTitle: "Berserk", author: "Kentaro Miura", synopsis: "Dark fantasy saga.", review: "세계관이 압도적.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=berserk" },
      { title: "Historie", searchTitle: "Historie", author: "Hitoshi Iwaaki", synopsis: "Ancient historical drama.", review: "몰입감 높은 서사.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=historie" },
      { title: "Kengan Ashura", searchTitle: "Kengan Ashura", author: "Yabako Sandrovich", synopsis: "Corporate martial arts battles.", review: "액션 템포가 좋음.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=kengan%20ashura" },
      { title: "One Piece", searchTitle: "One Piece", author: "Eiichiro Oda", synopsis: "Pirate adventure.", review: "장기 연재의 정석.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=one%20piece" },
      { title: "Chainsaw Man", searchTitle: "Chainsaw Man", author: "Tatsuki Fujimoto", synopsis: "Devil hunter action.", review: "연출이 강렬함.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=chainsaw%20man" },
      { title: "Slam Dunk", searchTitle: "Slam Dunk", author: "Takehiko Inoue", synopsis: "Basketball youth story.", review: "다시 봐도 명작.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=slam%20dunk" },
      { title: "Fullmetal Alchemist", searchTitle: "Fullmetal Alchemist", author: "Hiromu Arakawa", synopsis: "Alchemy adventure.", review: "완성도 높은 구성.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=fullmetal%20alchemist" },
      { title: "Jujutsu Kaisen", searchTitle: "Jujutsu Kaisen", author: "Gege Akutami", synopsis: "Cursed spirit battles.", review: "작화와 연출이 좋음.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=jujutsu%20kaisen" },
      { title: "Death Note", searchTitle: "Death Note", author: "Tsugumi Ohba", synopsis: "Psychological thriller.", review: "긴장감이 뛰어남.", kyoboUrl: "https://search.kyobobook.co.kr/search?keyword=death%20note" }
    ]
  }
];

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toKyoboSearch(title) {
  return `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(title || "")}`;
}

function toRidiSearch(title) {
  return `https://ridibooks.com/search?q=${encodeURIComponent(title || "")}`;
}

function CoverImage({ src, alt = "", className = "cell-poster" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <div className={`${className} image-fallback`} />;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function countBingoLines(indices) {
  const checked = indices instanceof Set ? indices : new Set(indices || []);
  return bingoLinePatterns.filter((line) => line.every((index) => checked.has(index))).length;
}

function normalizeRankingTitle(value) {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._\-:()[\]{}'"“”‘’!?！?·・,，。/\\]/g, "")
    .trim();
}

export default function App() {
  const [page, setPage] = useState(() => {
    const fromHash = window.location.hash?.replace("#", "");
    return fromHash || sessionStorage.getItem("duckgo_current_page") || "home";
  });
  const [boardFeed, setBoardFeed] = useState(initialBoards);
  const [makerCells, setMakerCells] = useState(Array(9).fill(null));
  const [activeCellIndex, setActiveCellIndex] = useState(-1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [directInputOpen, setDirectInputOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [displayTitleInput, setDisplayTitleInput] = useState("");
  const [jikanResults, setJikanResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);

  const [authId, setAuthId] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [boardTitle, setBoardTitle] = useState("덕후의 취향 빙고");
  const [boardOwnerId, setBoardOwnerId] = useState("");
  const [boardIsPublic, setBoardIsPublic] = useState(true);
  const [boardPassword, setBoardPassword] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [shareBoard, setShareBoard] = useState(null);
  const [archiveSort, setArchiveSort] = useState("latest");
  const [expandedSection, setExpandedSection] = useState("");
  const [manageBoardKey, setManageBoardKey] = useState("");
  const [managePasswordInput, setManagePasswordInput] = useState("");
  const [manageMsg, setManageMsg] = useState("");
  const [managedBoardId, setManagedBoardId] = useState("");
  const [editingBoardId, setEditingBoardId] = useState("");
  const [editBoardTitle, setEditBoardTitle] = useState("");
  const [editBoardPassword, setEditBoardPassword] = useState("");
  const [editBoardIsPublic, setEditBoardIsPublic] = useState(true);
  const [manageCommentBoardId, setManageCommentBoardId] = useState("");
  const [manageCommentRows, setManageCommentRows] = useState([]);

  const [previewBoard, setPreviewBoard] = useState(null);
  const [detailChecked, setDetailChecked] = useState(new Set());
  const [selectedPreviewCell, setSelectedPreviewCell] = useState(null);
  const [detailTab, setDetailTab] = useState("info");
  const [guestbookRows, setGuestbookRows] = useState([]);
  const [guestbookInput, setGuestbookInput] = useState("");
  const [guestbookMsg, setGuestbookMsg] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [responseRows, setResponseRows] = useState([]);
  const [responseNickname, setResponseNickname] = useState("");
  const [responseMsg, setResponseMsg] = useState("");
  const [activeResponse, setActiveResponse] = useState(null);
  const [translatedSynopsisMap, setTranslatedSynopsisMap] = useState({});
  const [showOriginalSynopsisMap, setShowOriginalSynopsisMap] = useState({});
  const [translatingKey, setTranslatingKey] = useState("");
  const [translationMsg, setTranslationMsg] = useState("");

  const [directForm, setDirectForm] = useState({ title: "", searchTitle: "", author: "", cover: "", synopsis: "", review: "", kyoboUrl: "", ridiUrl: "" });
  const [modalReview, setModalReview] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackType, setFeedbackType] = useState("info");
  const feedbackTimerRef = useRef(null);

  const filledCount = useMemo(() => makerCells.filter(Boolean).length, [makerCells]);
  const completedLineCount = useMemo(() => countBingoLines(detailChecked), [detailChecked]);
  const getBoardTime = (board) => {
    if (typeof board.createdAtMs === "number") return board.createdAtMs;
    const time = new Date(board.createdAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const rankingData = useMemo(() => {
    const m = new Map();
    boardFeed.forEach((b) => b.cells.forEach((c) => {
      if (!c?.title) return;
      const rankingKey = c.rankingKey || normalizeRankingTitle(c.searchTitle || c.title);
      if (!rankingKey) return;
      const current = m.get(rankingKey) || { title: c.title, count: 0, image: "", author: "", titleCounts: new Map() };
      const titleCounts = new Map(current.titleCounts);
      titleCounts.set(c.title, (titleCounts.get(c.title) || 0) + 1);
      const displayTitle = [...titleCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || c.title;
      m.set(rankingKey, {
        ...current,
        title: displayTitle,
        count: current.count + 1,
        image: current.image || c.image || "",
        author: current.author || c.author || "",
        titleCounts
      });
    }));
    return [...m.values()]
      .map((item) => ({
        title: item.title,
        count: item.count,
        image: item.image,
        author: item.author
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [boardFeed]);

  const sortedBoards = useMemo(() => {
    return [...boardFeed].sort((a, b) => {
      if (archiveSort === "popular") {
        const viewDifference = (b.views || 0) - (a.views || 0);
        if (viewDifference !== 0) return viewDifference;
        return getBoardTime(b) - getBoardTime(a);
      }
      const timeDifference = getBoardTime(b) - getBoardTime(a);
      if (timeDifference !== 0) return timeDifference;
      return (b.views || 0) - (a.views || 0);
    });
  }, [boardFeed, archiveSort]);

  const previewRankingData = useMemo(() => rankingData.slice(0, 5), [rankingData]);
  const previewBoards = useMemo(() => sortedBoards.slice(0, 8), [sortedBoards]);

  const myBoards = useMemo(() => {
    if (!currentUser) return [];
    return boardFeed
      .filter((board) => board.owner === currentUser || board.ownerUid === currentUserId)
      .sort((a, b) => getBoardTime(b) - getBoardTime(a));
  }, [boardFeed, currentUser, currentUserId]);

  function boardFromFirestore(id, data) {
    const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    return {
      id,
      title: data.title || "덕후의 취향 빙고",
      owner: data.owner || "비회원",
      ownerUid: data.ownerUid || "",
      isPublic: data.isPublic !== false,
      managePassword: data.managePassword || "",
      views: Number(data.views) || 0,
      createdAt: createdAtDate.toISOString().slice(0, 10),
      createdAtMs: createdAtDate.getTime(),
      cells: Array.isArray(data.cells) ? data.cells.map((c) => (c ? {
        ...c,
        searchTitle: c.searchTitle || c.title || "",
        rankingKey: c.rankingKey || normalizeRankingTitle(c.searchTitle || c.title || "")
      } : null)) : Array(9).fill(null)
    };
  }

  function getShareUrl(boardId) {
    return `${window.location.origin}${window.location.pathname}#board/${boardId}`;
  }

  function extractBoardId(value) {
    const text = value.trim();
    if (!text) return "";
    const hashMatch = text.match(/#board\/([^/?#]+)/);
    if (hashMatch?.[1]) return hashMatch[1];
    const pathMatch = text.match(/board\/([^/?#]+)/);
    if (pathMatch?.[1]) return pathMatch[1];
    return text.replace(/^#/, "").replace(/^board\//, "").trim();
  }

  function showBoardDetail(board) {
    setPreviewBoard(board);
    setSelectedPreviewCell(board.cells[0] || null);
    setDetailChecked(new Set());
    setDetailTab("info");
    setDeleteMsg("");
    setResponseMsg("");
    setActiveResponse(null);
    setTranslationMsg("");
    setPage("detail");
  }

  async function countBoardView(boardId) {
    if (!db || !boardId || boardId.startsWith("preview_") || boardId.startsWith("seed-")) return;
    try {
      await updateDoc(doc(db, "boards", boardId), { views: increment(1) });
    } catch {
      // 상세 화면 진입은 조회수 기록 실패와 관계없이 계속 진행한다.
    }
  }

  useEffect(() => {
    sessionStorage.setItem("duckgo_current_page", page);
    const nextHash = page === "detail" && previewBoard?.id && !previewBoard.id.startsWith("preview_") ? `#board/${previewBoard.id}` : `#${page}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash.slice(1);
    }
  }, [page, previewBoard?.id]);

  useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash.replace("#", "") || "home";
      if (next.startsWith("board/")) {
        const boardId = next.replace("board/", "");
        sessionStorage.setItem("duckgo_current_page", "detail");
        const lastViewedPath = sessionStorage.getItem("duckgo_counted_view");
        if (lastViewedPath !== next) {
          sessionStorage.setItem("duckgo_counted_view", next);
          countBoardView(boardId);
        }
        const local = boardFeed.find((board) => board.id === boardId);
        if (local) {
          showBoardDetail(local);
          return;
        }

        if (!db) {
          setFeedback("공유된 빙고를 불러오려면 Firebase 연결이 필요합니다.", "error");
          return;
        }

        getDoc(doc(db, "boards", boardId))
          .then((snap) => {
            if (!snap.exists()) {
              setFeedback("공유된 빙고를 찾을 수 없습니다.", "error");
              setPage("home");
              return;
            }
            showBoardDetail(boardFromFirestore(snap.id, snap.data()));
          })
          .catch(() => {
            setFeedback("공유된 빙고를 불러오지 못했습니다.", "error");
            setPage("home");
          });
        return;
      }
      sessionStorage.removeItem("duckgo_counted_view");
      setPage(next);
      sessionStorage.setItem("duckgo_current_page", next);
    };
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [boardFeed]);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u?.email || "");
      setCurrentUserId(u?.uid || "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db) return;
    let publicRows = [];
    let ownerRows = [];

    const publishRows = () => {
      const merged = new Map();
      [...publicRows, ...ownerRows].forEach((board) => merged.set(board.id, board));
      const rows = [...merged.values()].sort((a, b) => getBoardTime(b) - getBoardTime(a));
      setBoardFeed(rows.length > 0 ? rows : initialBoards);
    };

    const publicQuery = query(collection(db, "boards"), where("isPublic", "==", true));
    const unsubPublic = onSnapshot(publicQuery, (snap) => {
      publicRows = snap.docs.map((d) => boardFromFirestore(d.id, d.data()));
      publishRows();
    });

    let unsubOwner = () => {};
    if (currentUser) {
      const ownerQuery = query(collection(db, "boards"), where("owner", "==", currentUser));
      unsubOwner = onSnapshot(ownerQuery, (snap) => {
        ownerRows = snap.docs.map((d) => boardFromFirestore(d.id, d.data()));
        publishRows();
      });
    } else {
      publishRows();
    }

    return () => {
      unsubPublic();
      unsubOwner();
    };
  }, [currentUser]);

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (keyword.length < 2) {
      const t = setTimeout(() => {
        setJikanResults([]);
        setSearchError("");
        setIsSearching(false);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError("");
        const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(keyword)}&limit=6`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setJikanResults((json.data || []).map((item) => ({
          id: item.mal_id,
          title: item.title,
          searchTitle: item.title,
          synopsis: item.synopsis || "줄거리 정보 없음",
          image: item.images?.jpg?.image_url || "",
          author: item.authors?.[0]?.name || "",
          kyoboUrl: toKyoboSearch(item.title)
        })));
      } catch {
        setSearchError("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        setJikanResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function setFeedback(msg, type = "info") {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setFeedbackMsg(msg);
    setFeedbackType(type);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMsg("");
      feedbackTimerRef.current = null;
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function getSynopsisKey(cell = selectedPreviewCell) {
    if (!cell?.title) return "";
    return `${previewBoard?.id || "preview"}:${cell.title}`;
  }

  function getTranslatedSynopsis() {
    return translatedSynopsisMap[getSynopsisKey()] || "";
  }

  function shouldShowOriginalSynopsis() {
    return showOriginalSynopsisMap[getSynopsisKey()] === true;
  }

  function getDisplayedSynopsis() {
    const translated = getTranslatedSynopsis();
    if (translated && !shouldShowOriginalSynopsis()) return translated;
    return selectedPreviewCell?.synopsis || "-";
  }

  function showOriginalSynopsis() {
    const key = getSynopsisKey();
    if (!key) return;
    setShowOriginalSynopsisMap((prev) => ({ ...prev, [key]: true }));
    setTranslationMsg("원문을 표시했습니다.");
  }

  function decodeHtmlText(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function splitTextForTranslation(text, maxLength = 450) {
    const source = text.trim();
    if (source.length <= maxLength) return [source];

    const chunks = [];
    const sentences = source.match(/[^.!?。！？]+[.!?。！？]*/g) || [source];
    let current = "";

    sentences.forEach((sentence) => {
      const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
      if (next.length <= maxLength) {
        current = next;
        return;
      }

      if (current) chunks.push(current);
      if (sentence.length <= maxLength) {
        current = sentence.trim();
        return;
      }

      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.slice(i, i + maxLength).trim());
      }
      current = "";
    });

    if (current) chunks.push(current);
    return chunks.filter(Boolean);
  }

  async function translateTextChunk(text) {
    const params = new URLSearchParams({
      q: text,
      langpair: "en|ko"
    });
    const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
    if (!res.ok) throw new Error();
    const json = await res.json();
    const translated = decodeHtmlText(json.responseData?.translatedText || "").trim();
    if (!translated || json.responseStatus >= 400) throw new Error();
    return translated;
  }

  async function translateSelectedSynopsis() {
    const synopsis = selectedPreviewCell?.synopsis || "";
    const key = getSynopsisKey();
    if (!key || !synopsis || synopsis === "줄거리 정보 없음") {
      return setTranslationMsg("번역할 줄거리 정보가 없습니다.");
    }

    try {
      setTranslationMsg("");
      setTranslatingKey(key);
      const cachedTranslation = translatedSynopsisMap[key];
      if (cachedTranslation) {
        setShowOriginalSynopsisMap((prev) => ({ ...prev, [key]: false }));
        setTranslationMsg("한국어 번역을 적용했습니다.");
        return;
      }
      const chunks = splitTextForTranslation(synopsis);
      const translatedParts = [];
      for (const chunk of chunks) {
        translatedParts.push(await translateTextChunk(chunk));
      }
      const translated = translatedParts.join(" ").trim();
      if (!translated) throw new Error();
      setTranslatedSynopsisMap((prev) => ({ ...prev, [key]: translated }));
      setShowOriginalSynopsisMap((prev) => ({ ...prev, [key]: false }));
      setTranslationMsg("한국어 번역을 적용했습니다.");
    } catch {
      setTranslationMsg("번역에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setTranslatingKey("");
    }
  }

  function openPicker(idx) {
    setActiveCellIndex(idx);
    setPickerOpen(true);
    setDirectInputOpen(false);
    setSearchQuery("");
    setDisplayTitleInput("");
    setJikanResults([]);
    setSearchError("");
    setSelectedSearchResult(null);
    setModalReview("");
    setDirectForm({ title: "", searchTitle: "", author: "", cover: "", synopsis: "", review: "", kyoboUrl: "", ridiUrl: "" });
  }

  function applyToCell(payload) {
    if (activeCellIndex < 0) return;
    const item = {
      title: payload.title || "",
      searchTitle: payload.searchTitle || payload.title || "",
      image: (payload.image || payload.cover || "").trim(),
      author: payload.author || "",
      synopsis: payload.synopsis || "",
      review: payload.review || modalReview.trim(),
      kyoboUrl: payload.kyoboUrl || toKyoboSearch(payload.title || payload.searchTitle || ""),
      ridiUrl: payload.ridiUrl || toRidiSearch(payload.title || payload.searchTitle || "")
    };
    if (!item.title.trim()) return setFeedback("작품명은 필수입니다.", "error");
    item.rankingKey = normalizeRankingTitle(item.searchTitle || item.title);
    const next = [...makerCells];
    next[activeCellIndex] = item;
    setMakerCells(next);
    setPickerOpen(false);
    setActiveCellIndex(-1);
    setFeedback("작품이 칸에 추가되었습니다.", "success");
  }

  function selectSearchResult(item) {
    setSelectedSearchResult(item);
    setDisplayTitleInput("");
  }

  function registerSelectedResult() {
    if (!selectedSearchResult) return setFeedback("검색 결과에서 작품을 먼저 선택해 주세요.", "error");
    applyToCell({
      ...selectedSearchResult,
      title: displayTitleInput.trim() || selectedSearchResult.title,
      searchTitle: selectedSearchResult.searchTitle || selectedSearchResult.title,
      review: modalReview.trim()
    });
  }

  function applyDirectForm() {
    const title = directForm.title.trim();
    const searchTitle = directForm.searchTitle.trim();
    const cover = directForm.cover.trim();
    const kyoboUrl = directForm.kyoboUrl.trim();
    const ridiUrl = directForm.ridiUrl.trim();
    if (!title) return setFeedback("작품명은 필수입니다.", "error");
    if (cover && !isValidHttpUrl(cover)) return setFeedback("표지 URL은 http/https 형식이어야 합니다.", "error");
    if (kyoboUrl && !isValidHttpUrl(kyoboUrl)) return setFeedback("교보문고 링크 URL 형식이 올바르지 않습니다.", "error");
    if (ridiUrl && !isValidHttpUrl(ridiUrl)) return setFeedback("리디북스 링크 URL 형식이 올바르지 않습니다.", "error");
    applyToCell({
      title,
      searchTitle: searchTitle || title,
      author: directForm.author.trim(),
      cover,
      synopsis: directForm.synopsis.trim(),
      review: directForm.review.trim(),
      kyoboUrl: kyoboUrl || toKyoboSearch(title),
      ridiUrl: ridiUrl || toRidiSearch(title)
    });
  }

  function clearAllCells() {
    setMakerCells(Array(9).fill(null));
  }

  function removeCell(index) {
    setMakerCells((cells) => cells.map((cell, cellIndex) => (cellIndex === index ? null : cell)));
    setFeedback(`칸 ${index + 1}의 작품을 삭제했습니다.`, "info");
  }

  async function loginOrSignup() {
    if (!auth) return setFeedback("Firebase 인증 설정이 비활성 상태입니다.", "error");
    const email = authId.trim();
    const pw = authPw.trim();
    if (!email || !pw) return setFeedback("이메일/비밀번호를 입력해 주세요.", "error");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      setFeedback("로그인 완료", "success");
      setPage("home");
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, email, pw);
        setFeedback("회원가입 후 자동 로그인 완료", "success");
        setPage("home");
      } catch {
        setFeedback("로그인 실패: 이메일/비밀번호를 확인해 주세요.", "error");
      }
    }
  }

  async function loginWithGoogle() {
    if (!auth) return setFeedback("Firebase 인증 설정이 비활성 상태입니다.", "error");
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");

    try {
      const result = await signInWithPopup(auth, provider);
      setCurrentUser(result.user?.email || "");
      setFeedback("구글 로그인 완료", "success");
      setPage("home");
    } catch (error) {
      if (error.code === "auth/popup-blocked") {
        setFeedback("브라우저가 구글 로그인 팝업을 막았습니다. 주소창 근처의 팝업 차단 표시에서 localhost 팝업을 허용해 주세요.", "error");
      } else if (error.code === "auth/popup-closed-by-user") {
        setFeedback("구글 로그인 창이 완료 전에 닫혔습니다. 다시 눌러 로그인해 주세요.", "error");
      } else if (error.code === "auth/operation-not-allowed") {
        setFeedback("Firebase 콘솔에서 Google 로그인 제공자가 아직 켜져 있지 않습니다.", "error");
      } else if (error.code === "auth/unauthorized-domain") {
        setFeedback("현재 주소가 Firebase 승인 도메인에 없습니다. localhost 또는 배포 도메인을 추가해 주세요.", "error");
      } else {
        setFeedback(`구글 로그인 실패: ${error.code || "설정을 확인해 주세요."}`, "error");
      }
    }
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    setFeedback("로그아웃되었습니다.", "info");
  }

  useEffect(() => {
    if (!db || !currentUser || page !== "detail" || !previewBoard?.id) {
      const t = setTimeout(() => setGuestbookRows([]), 0);
      return () => clearTimeout(t);
    }

    const q = query(collection(db, "comments"), where("boardId", "==", previewBoard.id));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          body: data.body || "",
          author: data.author || "익명",
          authorUid: data.authorUid || "",
          hidden: data.hidden === true,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0)
        };
      }).filter((row) => !row.hidden);
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setGuestbookRows(rows);
    });
    return () => unsub();
  }, [currentUser, page, previewBoard?.id]);

  useEffect(() => {
    if (!db || page !== "detail" || !previewBoard?.id || previewBoard.id.startsWith("preview_")) {
      const t = setTimeout(() => setResponseRows([]), 0);
      return () => clearTimeout(t);
    }

    const q = query(collection(db, "boardResponses"), where("boardId", "==", previewBoard.id));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nickname: data.nickname || "익명",
          author: data.author || "",
          authorUid: data.authorUid || "",
          checkedIndices: Array.isArray(data.checkedIndices) ? data.checkedIndices : [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0)
        };
      });
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setResponseRows(rows);
    });
    return () => unsub();
  }, [page, previewBoard?.id]);

  async function submitGuestbook() {
    const body = guestbookInput.trim();
    if (!db) return setGuestbookMsg("Firebase DB가 아직 연결되지 않았습니다.");
    if (!currentUser) return setGuestbookMsg("댓글은 이메일 또는 구글 로그인 후 작성할 수 있습니다.");
    if (!previewBoard?.id) return setGuestbookMsg("빙고 정보를 찾을 수 없습니다.");
    if (body.length < 2) return setGuestbookMsg("댓글은 2글자 이상 입력해 주세요.");
    if (body.length > 200) return setGuestbookMsg("댓글은 200자 이내로 입력해 주세요.");

    try {
      await addDoc(collection(db, "comments"), {
        boardId: previewBoard.id,
        body,
        author: currentUser,
        authorUid: currentUserId,
        hidden: false,
        createdAt: serverTimestamp()
      });
      setGuestbookInput("");
      setGuestbookMsg("댓글이 등록되었습니다.");
    } catch {
      setGuestbookMsg("댓글 등록에 실패했습니다.");
    }
  }

  async function deleteMyComment(row) {
    if (!db) return setGuestbookMsg("Firebase DB가 아직 연결되지 않았습니다.");
    const isMyComment = row.authorUid ? row.authorUid === currentUserId : row.author === currentUser;
    if (!currentUser || !isMyComment) return setGuestbookMsg("내가 작성한 댓글만 삭제할 수 있습니다.");
    if (!window.confirm("이 댓글을 삭제할까요?")) return;

    try {
      await deleteDoc(doc(db, "comments", row.id));
      setGuestbookMsg("댓글을 삭제했습니다.");
    } catch (error) {
      if (error.code === "permission-denied") {
        setGuestbookMsg("댓글 삭제 권한이 없습니다. 작성한 계정으로 로그인해 주세요.");
      } else {
        setGuestbookMsg("댓글 삭제에 실패했습니다.");
      }
    }
  }

  async function submitBoardResponse() {
    const nickname = responseNickname.trim();
    if (!db) return setResponseMsg("Firebase DB가 아직 연결되지 않았습니다.");
    if (!previewBoard?.id || previewBoard.id.startsWith("preview_")) return setResponseMsg("업로드된 빙고에서만 결과를 등록할 수 있습니다.");
    if (previewBoard.id.startsWith("seed-")) return setResponseMsg("샘플 빙고에는 결과를 등록할 수 없습니다. 실제 업로드된 빙고에서 등록해 주세요.");
    if (!previewBoard.isPublic && previewBoard.owner !== currentUser) return setResponseMsg("비공개 빙고에는 작성자만 결과를 등록할 수 있습니다.");
    if (nickname.length < 2 || nickname.length > 12) return setResponseMsg("닉네임은 2~12자로 입력해 주세요.");
    if (detailChecked.size === 0) return setResponseMsg("본 작품을 한 칸 이상 체크해 주세요.");

    try {
      await addDoc(collection(db, "boardResponses"), {
        boardId: previewBoard.id,
        nickname,
        author: currentUser || "",
        authorUid: currentUserId || "",
        checkedIndices: [...detailChecked].sort((a, b) => a - b),
        createdAt: serverTimestamp()
      });
      setResponseNickname("");
      setResponseMsg("푼 빙고 결과를 등록했습니다.");
      setDetailTab("results");
    } catch (error) {
      if (error.code === "permission-denied") {
        setResponseMsg("결과 등록 권한이 없습니다. 비공개 빙고이거나 기존 보드 공개 설정이 필요할 수 있습니다.");
      } else {
        setResponseMsg(`결과 등록에 실패했습니다. ${error.code || ""}`);
      }
    }
  }

  function showResponseResult(response) {
    setActiveResponse(response);
    setDetailChecked(new Set(response.checkedIndices));
  }

  function restoreMyResult() {
    setActiveResponse(null);
    setDetailChecked(new Set());
    setResponseMsg("");
  }

  async function deleteMyResponse(response) {
    if (!db) return setResponseMsg("Firebase DB가 아직 연결되지 않았습니다.");
    if (!currentUserId || response.authorUid !== currentUserId) return setResponseMsg("로그인한 본인의 풀이 결과만 삭제할 수 있습니다.");
    if (!window.confirm(`"${response.nickname}" 풀이 결과를 삭제할까요?`)) return;

    try {
      await deleteDoc(doc(db, "boardResponses", response.id));
      if (activeResponse?.id === response.id) restoreMyResult();
      setResponseMsg("내 풀이 결과를 삭제했습니다.");
    } catch (error) {
      if (error.code === "permission-denied") {
        setResponseMsg("삭제 권한이 없습니다. 결과를 등록한 계정으로 로그인해 주세요.");
      } else {
        setResponseMsg("풀이 결과 삭제에 실패했습니다.");
      }
    }
  }

  async function loadManageComments(board) {
    if (!db) return setManageMsg("Firebase DB가 아직 연결되지 않았습니다.");
    try {
      const q = query(collection(db, "comments"), where("boardId", "==", board.id));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          boardId: data.boardId || "",
          body: data.body || "",
          author: data.author || "익명",
          hidden: data.hidden === true,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0)
        };
      });
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setManageCommentBoardId(board.id);
      setManageCommentRows(rows);
      setManageMsg(rows.length === 0 ? "관리할 댓글이 없습니다." : "댓글 목록을 불러왔습니다.");
    } catch {
      setManageMsg("댓글 목록을 불러오지 못했습니다.");
    }
  }

  async function toggleCommentHidden(comment) {
    if (!db) return setManageMsg("Firebase DB가 아직 연결되지 않았습니다.");
    try {
      const nextHidden = !comment.hidden;
      await updateDoc(doc(db, "comments", comment.id), { hidden: nextHidden });
      setManageCommentRows((rows) => rows.map((row) => (
        row.id === comment.id ? { ...row, hidden: nextHidden } : row
      )));
      setManageMsg(nextHidden ? "댓글을 숨김 처리했습니다." : "댓글 숨김을 해제했습니다.");
    } catch (error) {
      if (error.code === "permission-denied") {
        setManageMsg("댓글 숨김 권한이 없습니다. 빙고 작성자 계정으로 로그인해 주세요.");
      } else {
        setManageMsg("댓글 상태를 변경하지 못했습니다.");
      }
    }
  }

  function startManageEdit(board) {
    setEditingBoardId(board.id);
    setEditBoardTitle(board.title || "");
    setEditBoardPassword(board.managePassword || "");
    setEditBoardIsPublic(board.isPublic !== false);
    setManageMsg("");
  }

  function cancelManageEdit() {
    setEditingBoardId("");
    setEditBoardTitle("");
    setEditBoardPassword("");
    setEditBoardIsPublic(true);
  }

  async function saveManagedBoard(board) {
    if (!db) return setManageMsg("Firebase DB가 아직 연결되지 않았습니다.");
    const title = editBoardTitle.trim() || "덕후의 취향 빙고";
    const password = editBoardPassword.trim();
    if (password.length < 4) return setManageMsg("관리 비밀번호는 4자 이상 입력해 주세요.");

    try {
      await updateDoc(doc(db, "boards", board.id), {
        title,
        isPublic: editBoardIsPublic,
        managePassword: password
      });
      setBoardFeed((rows) => rows.map((row) => (
        row.id === board.id ? { ...row, title, isPublic: editBoardIsPublic, managePassword: password } : row
      )));
      if (previewBoard?.id === board.id) {
        setPreviewBoard((current) => current ? { ...current, title, isPublic: editBoardIsPublic, managePassword: password } : current);
      }
      cancelManageEdit();
      setManageMsg("빙고 정보를 수정했습니다.");
    } catch (error) {
      if (error.code === "permission-denied") {
        setManageMsg("수정 권한이 없습니다. 작성자 계정으로 로그인했는지 확인해 주세요.");
      } else {
        setManageMsg("수정에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  async function deleteBoardFromManage(board) {
    if (!db) return setManageMsg("Firebase DB가 아직 연결되지 않았습니다.");
    if (!window.confirm(`"${board.title}" 빙고를 삭제할까요?`)) return;

    try {
      await deleteDoc(doc(db, "boards", board.id));
      setBoardFeed((rows) => rows.filter((row) => row.id !== board.id));
      if (previewBoard?.id === board.id) setPreviewBoard(null);
      if (editingBoardId === board.id) cancelManageEdit();
      setManageMsg("빙고가 삭제되었습니다.");
    } catch (error) {
      if (error.code === "permission-denied") {
        setManageMsg("삭제 권한이 없습니다. 작성자 계정으로 로그인했는지 확인해 주세요.");
      } else {
        setManageMsg("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  async function deleteCurrentBoard() {
    if (!db) return setDeleteMsg("Firebase DB가 아직 연결되지 않았습니다.");
    if (!previewBoard?.id || previewBoard.id.startsWith("preview_")) return setDeleteMsg("저장된 빙고만 삭제할 수 있습니다.");
    const canDeleteWithAccount = currentUser && previewBoard.owner === currentUser;
    const canDeleteWithManagePassword = managedBoardId === previewBoard.id;
    if (!canDeleteWithAccount && !canDeleteWithManagePassword) {
      return setDeleteMsg("삭제하려면 작성자 계정으로 로그인하거나 관리 페이지에서 비밀번호 인증을 해주세요.");
    }
    if (!window.confirm(`"${previewBoard.title}" 빙고를 삭제할까요?`)) return;

    try {
      await deleteDoc(doc(db, "boards", previewBoard.id));
      setBoardFeed((rows) => rows.filter((row) => row.id !== previewBoard.id));
      setPreviewBoard(null);
      setDeleteMsg("");
      setManagedBoardId("");
      setFeedback("빙고가 삭제되었습니다.", "success");
      setPage("home");
    } catch {
      setDeleteMsg("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function openManagedBoard() {
    if (!db) return setManageMsg("Firebase DB가 아직 연결되지 않았습니다.");
    const boardId = extractBoardId(manageBoardKey);
    const password = managePasswordInput.trim();
    if (!boardId) return setManageMsg("빙고 링크 또는 ID를 입력해 주세요.");
    if (!password) return setManageMsg("관리 비밀번호를 입력해 주세요.");

    try {
      const snap = await getDoc(doc(db, "boards", boardId));
      if (!snap.exists()) {
        setManageMsg("해당 빙고를 찾을 수 없습니다. ID를 다시 확인해 주세요.");
        return;
      }
      const data = snap.data();
      if ((data.managePassword || "") !== password) {
        setManageMsg("관리 비밀번호가 일치하지 않습니다.");
        return;
      }
      const board = boardFromFirestore(snap.id, data);
      setManagedBoardId(board.id);
      setManageMsg("");
      showBoardDetail(board);
    } catch (error) {
      if (error.code === "permission-denied") {
        setManageMsg("빙고를 불러올 권한이 없습니다. Firebase 규칙 배포 상태를 확인해 주세요.");
      } else {
        setManageMsg("빙고를 불러오지 못했습니다. 링크 또는 ID를 다시 확인해 주세요.");
      }
    }
  }

  async function copyShareLink(board = shareBoard, notify = setUploadMsg) {
    if (!board?.id) return notify("먼저 빙고를 업로드해 주세요.");
    const url = getShareUrl(board.id);
    try {
      await navigator.clipboard.writeText(url);
      notify("공유 링크를 복사했습니다.");
    } catch {
      notify(url);
    }
  }

  async function shareLink(board = shareBoard, notify = setUploadMsg) {
    if (!board?.id) return notify("먼저 빙고를 업로드해 주세요.");
    const url = getShareUrl(board.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: board.title, text: "내 만화 취향 빙고를 확인해 보세요.", url });
        notify("공유를 열었습니다.");
      } catch {
        notify("공유가 취소되었습니다.");
      }
      return;
    }
    copyShareLink(board, notify);
  }

  function loadCanvasImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(null), 5000);
      img.crossOrigin = "anonymous";
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    });
  }

  function drawCover(ctx, img, x, y, width, height) {
    if (!img) return false;
    const imageRatio = img.width / img.height;
    const boxRatio = width / height;
    let sourceWidth = img.width;
    let sourceHeight = img.height;
    let sourceX = 0;
    let sourceY = 0;

    if (imageRatio > boxRatio) {
      sourceWidth = img.height * boxRatio;
      sourceX = (img.width - sourceWidth) / 2;
    } else {
      sourceHeight = img.width / boxRatio;
      sourceY = (img.height - sourceHeight) / 2;
    }

    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
    return true;
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, maxLines, lineHeight) {
    const words = (text || "빈 칸").split(/\s+/);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  }

  async function makeBoardImageBlob(board = shareBoard) {
    if (!board) return Promise.reject(new Error("empty board"));
    const canvas = document.createElement("canvas");
    const size = 1080;
    const padding = 54;
    const gap = 18;
    const header = 100;
    const cellWidth = (size - padding * 2 - gap * 2) / 3;
    const cellHeight = Math.round(cellWidth * 1.34);
    const boardHeight = cellHeight * 3 + gap * 2;
    canvas.width = size;
    canvas.height = header + boardHeight + padding;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f1f1f2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fcfcfd";
    ctx.fillRect(24, 24, canvas.width - 48, canvas.height - 48);
    ctx.strokeStyle = "#d5d5da";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = "#1f1f22";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(board.title || "덕고 빙고", size / 2, 70);

    const images = await Promise.all(board.cells.map((cell) => loadCanvasImage(cell?.image)));

    board.cells.forEach((cell, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = padding + col * (cellWidth + gap);
      const y = header + row * (cellHeight + gap);
      const inner = 22;
      const posterX = x + inner;
      const posterY = y + inner;
      const posterWidth = cellWidth - inner * 2;
      const posterHeight = Math.round(posterWidth * 1.18);
      const titleY = posterY + posterHeight + 40;

      ctx.fillStyle = "#fff5f8";
      ctx.beginPath();
      ctx.roundRect(x, y, cellWidth, cellHeight, 24);
      ctx.fill();
      ctx.strokeStyle = "#c57a90";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(posterX, posterY, posterWidth, posterHeight, 16);
      ctx.clip();
      const drewImage = drawCover(ctx, images[i], posterX, posterY, posterWidth, posterHeight);
      ctx.restore();

      if (!drewImage) {
        ctx.fillStyle = "#f3eef1";
        ctx.beginPath();
        ctx.roundRect(posterX, posterY, posterWidth, posterHeight, 16);
        ctx.fill();
        ctx.strokeStyle = "#d6c8cf";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.roundRect(posterX, posterY, posterWidth, posterHeight, 16);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#9e1b3f";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      drawWrappedText(ctx, cell?.title || "빈 칸", x + cellWidth / 2, titleY, cellWidth - 36, 2, 32);
    });

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function downloadBoardImage(board = shareBoard, notify = setUploadMsg) {
    if (!board) return notify("먼저 빙고를 업로드해 주세요.");
    let blob;
    try {
      blob = await makeBoardImageBlob(board);
    } catch {
      return notify("이미지를 만들지 못했습니다. 일부 표지 링크를 확인해 주세요.");
    }
    if (!blob) return notify("이미지를 만들지 못했습니다. 일부 표지 링크를 확인해 주세요.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${board.title || "duck-go-bingo"}.png`;
    a.click();
    URL.revokeObjectURL(url);
    notify("빙고 이미지를 저장했습니다.");
  }

  async function shareBoardImage(board = shareBoard, notify = setUploadMsg) {
    if (!board) return notify("먼저 빙고를 업로드해 주세요.");
    let blob;
    try {
      blob = await makeBoardImageBlob(board);
    } catch {
      return notify("이미지를 만들지 못했습니다. 일부 표지 링크를 확인해 주세요.");
    }
    if (!blob) return notify("이미지를 만들지 못했습니다. 일부 표지 링크를 확인해 주세요.");
    const file = new File([blob], "duck-go-bingo.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ title: board.title, text: "내 만화 취향 빙고입니다.", files: [file] });
        notify("이미지 공유를 열었습니다.");
      } catch {
        notify("이미지 공유가 취소되었습니다.");
      }
      return;
    }
    downloadBoardImage(board, notify);
  }

  async function uploadBoard() {
    if (!db) return setUploadMsg("Firebase DB가 아직 연결되지 않았습니다.");
    setShareBoard(null);
    if (filledCount !== 9) return setUploadMsg("업로드 전에 9칸을 모두 채워주세요.");
    const ownerName = currentUser || boardOwnerId.trim();
    if (!ownerName) return setUploadMsg("비회원 업로드는 작성자 아이디를 입력해 주세요.");
    if (!currentUser && ownerName.length < 2) return setUploadMsg("작성자 아이디는 2자 이상 입력해 주세요.");
    if (boardPassword.trim().length < 4) return setUploadMsg("관리 비밀번호는 4자 이상 입력해 주세요.");
    const payload = {
      title: boardTitle.trim() || "덕후의 취향 빙고",
      owner: ownerName,
      ownerUid: currentUserId || "",
      isPublic: boardIsPublic,
      managePassword: boardPassword.trim(),
      cells: makerCells,
      views: 0,
      createdAt: serverTimestamp()
    };
    try {
      const saved = await addDoc(collection(db, "boards"), payload);
      const board = {
        id: saved.id,
        title: payload.title,
        owner: payload.owner,
        ownerUid: payload.ownerUid,
        isPublic: payload.isPublic,
        cells: payload.cells,
        views: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        createdAtMs: Date.now()
      };
      setShareBoard(board);
      setUploadMsg("업로드 완료! 아래에서 링크나 사진으로 공유할 수 있습니다.");
    } catch {
      setUploadMsg("업로드 실패");
    }
  }

  function openPreview() {
    if (filledCount !== 9) return;
    const board = {
      id: `preview_${Date.now()}`,
      title: boardTitle,
      owner: currentUser || boardOwnerId.trim() || "비회원",
      ownerUid: currentUserId || "",
      isPublic: boardIsPublic,
      createdAt: new Date().toISOString().slice(0, 10),
      createdAtMs: Date.now(),
      cells: makerCells
    };
    setPreviewBoard(board);
    setSelectedPreviewCell(board.cells[0]);
    setDetailChecked(new Set());
    setDetailTab("info");
    setDeleteMsg("");
    setTranslationMsg("");
    setPage("detail");
  }

  function togglePreviewCheck(i) {
    setTranslationMsg("");
    if (activeResponse) {
      setSelectedPreviewCell(previewBoard?.cells[i] || null);
      return;
    }
    const next = new Set(detailChecked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDetailChecked(next);
    setActiveResponse(null);
    setSelectedPreviewCell(previewBoard?.cells[i] || null);
  }

  const visibleResults = jikanResults.length > 0
    ? jikanResults
    : fallbackOptions.map((t) => ({ title: t, searchTitle: t, synopsis: "", image: "", author: "", kyoboUrl: toKyoboSearch(t) }));

  return (
    <>
      <header className="topbar">
        <button className="linklike brand" onClick={() => setPage("home")}>덕고(Duck-Go)</button>
        <nav>
          <button className="linklike" onClick={() => { setExpandedSection("boards"); setPage("expanded"); }}>탐색</button>
          <button className="linklike" onClick={() => { setExpandedSection("ranking"); setPage("expanded"); }}>랭킹</button>
          <button className="linklike" onClick={() => setPage("maker")}>제작소</button>
          <button className="linklike" onClick={() => setPage("manage")}>관리</button>
          <button className="btn small login-btn" onClick={() => currentUser ? logout() : setPage("login")}>{currentUser ? "로그아웃" : "로그인"}</button>
        </nav>
      </header>

      <main className="container">
        {feedbackMsg && <p className={`status ${feedbackType}`}>{feedbackMsg}</p>}

        {page === "home" && (
          <>
            <section className="hero panel">
              <h1 className="hero-title">덕고에 오신 것을 환영합니다</h1>
              <p className="hero-desc">
                덕고는 취향 빙고 생성부터 공유, 참여, 댓글 소통까지 한 번에 이어지는 만화 특화 웹 서비스입니다.
              </p>
              <button className="btn primary hero-main-btn" onClick={() => setPage("maker")}>내 빙고판 만들기</button>
            </section>

            <section className="panel">
              <div className="head"><h2>실시간 인기 만화 Top 5</h2><button className="linklike section-link" onClick={() => { setExpandedSection("ranking"); setPage("expanded"); }}>전체보기</button></div>
              <div className="rank-grid">
                {previewRankingData.length === 0 ? (
                  <div className="empty-state">아직 랭킹에 반영할 작품이 없습니다. 첫 빙고를 업로드해 보세요.</div>
                ) : (
                  previewRankingData.map((x, idx) => (
                    <article className="rank-card" key={`${x.title}-${idx}`}>
                      <CoverImage src={x.image} alt={x.title} className="rank-cover" />
                      <div className="meta"><strong>#{idx + 1} {x.title}</strong><br />등록 {x.count}회</div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="panel browse-panel">
              <div className="head"><h2>빙고판 둘러보기</h2><button className="linklike section-link" onClick={() => { setExpandedSection("boards"); setPage("expanded"); }}>전체보기</button></div>
              <div className="split-2">
                <article className={`card-item browse-option ${archiveSort === "popular" ? "active" : ""}`}>
                  <h3>인기 빙고 둘러보기</h3>
                  <p className="meta">조회수가 높은 빙고판을 먼저 확인해 보세요.</p>
                  <button className={`btn ${archiveSort === "popular" ? "primary" : ""}`} onClick={() => setArchiveSort("popular")}>인기 빙고 보기</button>
                </article>
                <article className={`card-item browse-option ${archiveSort === "latest" ? "active" : ""}`}>
                  <h3>최신 빙고 둘러보기</h3>
                  <p className="meta">방금 올라온 빙고판을 빠르게 확인해 보세요.</p>
                  <button className={`btn ${archiveSort === "latest" ? "primary" : ""}`} onClick={() => setArchiveSort("latest")}>최신 빙고 보기</button>
                </article>
              </div>
              <div className="latest-grid">
                {previewBoards.length === 0 ? (
                  <div className="empty-state">아직 공개된 빙고가 없습니다. 제작소에서 빙고를 업로드해 보세요.</div>
                ) : (
                  previewBoards.map((b) => (
                    <article className="rank-card clickable" key={b.id} onClick={() => { setPreviewBoard(b); setSelectedPreviewCell(b.cells[0] || null); setDetailChecked(new Set()); setTranslationMsg(""); setPage("detail"); }}>
                      <div className="board-mini-grid" aria-hidden="true">
                        {b.cells.map((cell, cellIndex) => (
                          <div className="board-mini-cell" key={`${b.id}-${cellIndex}`}>
                            <CoverImage src={cell?.image} alt={cell?.title || ""} className="board-mini-cover" />
                          </div>
                        ))}
                      </div>
                      <div className="meta">
                        <strong>{b.title}</strong><br />
                        조회 {b.views || 0}회 · {b.isPublic ? "공개" : "비공개"}<br />
                        {b.createdAt}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {page === "expanded" && (
          <section className="panel expanded-panel">
            <div className="head">
              <h2>{expandedSection === "ranking" ? "실시간 인기 만화 전체보기" : "빙고판 전체보기"}</h2>
              <button className="btn" onClick={() => setPage("home")}>돌아가기</button>
            </div>

            {expandedSection === "ranking" ? (
              <div className="rank-grid expanded-grid">
                {rankingData.length === 0 ? (
                  <div className="empty-state">아직 랭킹에 반영할 작품이 없습니다.</div>
                ) : (
                  rankingData.map((x, idx) => (
                    <article className="rank-card" key={`expanded-${x.title}-${idx}`}>
                      <CoverImage src={x.image} alt={x.title} className="rank-cover" />
                      <div className="meta"><strong>#{idx + 1} {x.title}</strong><br />등록 {x.count}회</div>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="archive-toggle">
                  <button className={`btn ${archiveSort === "popular" ? "primary" : ""}`} onClick={() => setArchiveSort("popular")}>인기순</button>
                  <button className={`btn ${archiveSort === "latest" ? "primary" : ""}`} onClick={() => setArchiveSort("latest")}>최신순</button>
                </div>
                <div className="latest-grid expanded-grid">
                  {sortedBoards.length === 0 ? (
                    <div className="empty-state">아직 둘러볼 빙고가 없습니다. 제작소에서 첫 빙고를 만들어 보세요.</div>
                  ) : (
                    sortedBoards.map((b) => (
                      <article className="rank-card clickable" key={`expanded-${b.id}`} onClick={() => showBoardDetail(b)}>
                        <div className="board-mini-grid" aria-hidden="true">
                          {b.cells.map((cell, cellIndex) => (
                            <div className="board-mini-cell" key={`${b.id}-expanded-${cellIndex}`}>
                              <CoverImage src={cell?.image} alt={cell?.title || ""} className="board-mini-cover" />
                            </div>
                          ))}
                        </div>
                        <div className="meta">
                          <strong>{b.title}</strong><br />
                          조회 {b.views || 0}회 · {b.isPublic ? "공개" : "비공개"}<br />
                          {b.createdAt}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {page === "maker" && (
          <section className="panel maker-panel">
            <h2>제작소</h2>
            {!isFirebaseConfigured && (
              <p className="status error">Firebase 설정값이 비어 있어 로그인/업로드가 비활성화되어 있습니다.</p>
            )}
            {currentUser ? (
              <div className="row"><p className="meta">로그인: {currentUser}</p><button className="btn" onClick={logout}>로그아웃</button></div>
            ) : (
              <div className="login-notice">
                <p className="meta">로그인 없이도 작성자 아이디와 관리 비밀번호로 빙고를 업로드할 수 있습니다.</p>
                <button className="btn" onClick={() => setPage("login")}>로그인해서 등록하기</button>
              </div>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" onClick={clearAllCells}>전체 초기화</button>
              <button className="btn primary" onClick={openPreview}>미리보기</button>
            </div>

            <div className="completion-block">
              <div className="completion-label"><strong>완료도</strong><span>{filledCount}/9</span></div>
              <div className="completion-track"><span style={{ width: `${(filledCount / 9) * 100}%` }} /></div>
            </div>

            <div className="maker-grid">
              {makerCells.map((item, i) => (
                <div key={i} className={`card-item bingo-cell maker-cell ${item ? "filled" : ""}`}>
                  {item ? (
                    <>
                      <button className="cell-edit-button" onClick={() => openPicker(i)} aria-label={`${item.title} 수정`}>
                        <div className="cell-content">
                          <CoverImage src={item.image} alt={item.title} />
                          <strong className="cell-title">{item.title}</strong>
                        </div>
                      </button>
                      <button className="cell-delete-button" onClick={() => removeCell(i)} aria-label={`${item.title} 삭제`} title="이 칸 삭제">×</button>
                    </>
                  ) : (
                    <button className="cell-edit-button empty" onClick={() => openPicker(i)}>칸 {i + 1}</button>
                  )}
                </div>
              ))}
            </div>

            <section className="panel inner">
              <h3>빙고 업로드</h3>
              <input className="field" placeholder="빙고 제목" value={boardTitle} onChange={(e) => setBoardTitle(e.target.value)} />
              {!currentUser && (
                <input
                  className="field"
                  placeholder="작성자 아이디 2자 이상"
                  value={boardOwnerId}
                  onChange={(e) => setBoardOwnerId(e.target.value)}
                />
              )}
              <input
                className="field"
                type="password"
                placeholder="관리 비밀번호 4자 이상"
                value={boardPassword}
                onChange={(e) => setBoardPassword(e.target.value)}
              />
              <label className="visibility-control">
                <input type="checkbox" checked={boardIsPublic} onChange={(e) => setBoardIsPublic(e.target.checked)} />
                <span>
                  <strong>공개 빙고</strong>
                  <small>{boardIsPublic ? "메인 목록과 공유 링크에서 다른 사용자에게 공개됩니다." : "작성자 계정에서만 확인할 수 있습니다."}</small>
                </span>
              </label>
              <button className="btn primary" onClick={uploadBoard}>빙고 업로드</button>
              {uploadMsg && <p className={shareBoard ? "upload-success" : "meta"}>{uploadMsg}</p>}
              {shareBoard && (
                <div className="share-box">
                  {!currentUser && (
                    <div className="guest-upload-notice">
                      <strong>비회원 관리 안내</strong>
                      <span>수정이나 삭제를 하려면 아래 빙고 ID와 방금 입력한 관리 비밀번호가 필요합니다. 잊지 않게 저장해 주세요.</span>
                    </div>
                  )}
                  <input className="field share-url" value={shareBoard.id} readOnly aria-label="빙고 ID" />
                  <input className="field share-url" value={getShareUrl(shareBoard.id)} readOnly aria-label="공유 링크" />
                  <div className="share-actions">
                    <button className="btn" onClick={() => copyShareLink()}>링크 복사</button>
                    <button className="btn" onClick={() => shareLink()}>링크 공유</button>
                    <button className="btn" onClick={() => downloadBoardImage()}>사진 저장</button>
                    <button className="btn primary" onClick={() => shareBoardImage()}>사진 공유</button>
                  </div>
                  <button className="btn primary home-after-upload" onClick={() => setPage("home")}>홈으로 돌아가기</button>
                </div>
              )}
            </section>
          </section>
        )}

        {page === "login" && (
          <section className="panel login-panel">
            <h2>로그인</h2>
            <p className="meta">댓글과 방명록 작성/조회는 로그인 후 사용할 수 있습니다. 빙고 업로드는 제작소에서 비회원으로도 가능합니다.</p>
            {!isFirebaseConfigured && (
              <p className="status error">Firebase 설정값이 비어 있어 로그인이 비활성화되어 있습니다.</p>
            )}
            {currentUser ? (
              <div className="login-card">
                <p className="meta">현재 로그인 계정</p>
                <strong>{currentUser}</strong>
                <button className="btn" onClick={logout}>로그아웃</button>
              </div>
            ) : (
              <div className="login-card">
                <input className="field" placeholder="이메일" value={authId} onChange={(e) => setAuthId(e.target.value)} />
                <input className="field" type="password" placeholder="비밀번호" value={authPw} onChange={(e) => setAuthPw(e.target.value)} />
                <button className="btn primary full" onClick={loginOrSignup}>이메일로 로그인 / 가입</button>
                <button className="btn full" onClick={loginWithGoogle}>구글로 로그인</button>
              </div>
            )}
          </section>
        )}

        {page === "detail" && previewBoard && (
          <section className="panel" id="detail">
            <div className="head">
              <h2>{previewBoard.title}</h2>
              <div className="detail-actions">
                {((currentUser && previewBoard.owner === currentUser) || managedBoardId === previewBoard.id) && !previewBoard.id.startsWith("preview_") && (
                  <button className="btn danger" onClick={deleteCurrentBoard}>삭제</button>
                )}
                <button className="btn" onClick={() => setPage("home")}>홈으로 돌아가기</button>
              </div>
            </div>
            <p className="meta">
              작성자: {previewBoard.owner} · {previewBoard.isPublic ? "공개" : "비공개"} ·
              {activeResponse ? ` ${activeResponse.nickname}님의 결과` : " 내가 푼 결과"} · 체크: {detailChecked.size}/9 · 빙고 {completedLineCount}줄
            </p>
            {deleteMsg && <p className="status error">{deleteMsg}</p>}

            <div className="detail-layout">
              <section className="detail-board">
                {activeResponse && (
                  <div className="result-view-banner">
                    <div>
                      <strong>{activeResponse.nickname}님의 풀이 결과를 보는 중</strong>
                      <span>체크 {activeResponse.checkedIndices.length}/9 · 빙고 {countBingoLines(activeResponse.checkedIndices)}줄 · 내 결과를 다시 풀려면 원본으로 돌아가세요.</span>
                    </div>
                    <button className="btn" onClick={restoreMyResult}>원본으로 돌아가기</button>
                  </div>
                )}

                <div className="completion-block detail-completion">
                  <div className="completion-label"><strong>빙고 완료도</strong><span>{detailChecked.size}/9 · {completedLineCount}줄</span></div>
                  <div className="completion-track"><span style={{ width: `${(detailChecked.size / 9) * 100}%` }} /></div>
                </div>

                <div className="maker-grid detail-grid">
                  {previewBoard.cells.map((item, i) => (
                    <button key={i} className={`card-item bingo-cell ${detailChecked.has(i) ? "filled" : ""}`} onClick={() => togglePreviewCheck(i)}>
                      {item ? <div className="cell-content"><CoverImage src={item.image} alt={item.title} /><strong className="cell-title">{item.title}</strong></div> : <span>빈 칸</span>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="detail-side">
                <section className="card-item response-submit-card">
                  <div>
                    <h3>내가 푼 빙고 등록</h3>
                    <p className="meta">
                      {previewBoard.id.startsWith("seed-")
                        ? "샘플 빙고는 체험용이라 결과를 저장할 수 없습니다."
                        : "왼쪽 빙고판에서 본 작품을 체크한 뒤 닉네임으로 결과를 남길 수 있습니다."}
                    </p>
                    {!previewBoard.id.startsWith("seed-") && <p className="bingo-line-badge">현재 빙고 {completedLineCount}줄</p>}
                  </div>
                  <div className="response-form">
                    <input
                      className="field"
                      value={responseNickname}
                      onChange={(e) => setResponseNickname(e.target.value)}
                      placeholder="닉네임 2~12자"
                      maxLength="12"
                    />
                    <button className="btn primary" onClick={submitBoardResponse} disabled={previewBoard.id.startsWith("seed-")}>현재 체크 결과 등록</button>
                  </div>
                  {responseMsg && <p className="meta">{responseMsg}</p>}
                </section>

                <div className="row tab-row">
                  <button className={`btn ${detailTab === "info" ? "primary" : ""}`} onClick={() => setDetailTab("info")}>작품정보</button>
                  <button className={`btn ${detailTab === "comment" ? "primary" : ""}`} onClick={() => setDetailTab("comment")}>코멘트</button>
                  <button className={`btn ${detailTab === "guestbook" ? "primary" : ""}`} onClick={() => setDetailTab("guestbook")}>방명록</button>
                  <button className={`btn ${detailTab === "results" ? "primary" : ""}`} onClick={() => setDetailTab("results")}>푼 빙고 {responseRows.length}</button>
                </div>

                {detailTab === "info" && (
                  <>
                    <article className="card-item">
                      <h3>{selectedPreviewCell?.title || "칸을 선택해주세요"}</h3>
                      <p className="meta"><strong>작가:</strong> {selectedPreviewCell?.author || "-"}</p>
                      <p className="meta synopsis-text"><strong>줄거리:</strong> {getDisplayedSynopsis()}</p>
                      {selectedPreviewCell?.synopsis && (
                        <div className="translation-row">
                          {getTranslatedSynopsis() && !shouldShowOriginalSynopsis() ? (
                            <button className="btn small" onClick={showOriginalSynopsis}>원문 보기</button>
                          ) : (
                            <button className="btn small" onClick={translateSelectedSynopsis} disabled={translatingKey === getSynopsisKey()}>
                              {translatingKey === getSynopsisKey() ? "번역 중..." : "한국어로 번역"}
                            </button>
                          )}
                          {translationMsg && <span>{translationMsg}</span>}
                        </div>
                      )}
                    </article>
                    {selectedPreviewCell?.title && (
                      <div className="detail-link-block">
                        <a className="btn" href={selectedPreviewCell.kyoboUrl || toKyoboSearch(selectedPreviewCell.title || selectedPreviewCell.searchTitle)} target="_blank" rel="noreferrer">교보문고에서 보기</a>
                        <a className="btn" href={selectedPreviewCell.ridiUrl || toRidiSearch(selectedPreviewCell.title || selectedPreviewCell.searchTitle)} target="_blank" rel="noreferrer">리디북스에서 보기</a>
                      </div>
                    )}
                  </>
                )}

                {detailTab === "comment" && <article className="card-item"><h3>주인장 코멘트</h3><p>{selectedPreviewCell?.review || "감상평이 아직 없습니다."}</p></article>}

                {detailTab === "guestbook" && (
                  <section className="card-item guestbook">
                    <h3>방명록</h3>
                    {currentUser ? (
                      <>
                        <textarea className="field" rows="3" value={guestbookInput} onChange={(e) => setGuestbookInput(e.target.value)} placeholder="댓글을 남겨주세요. 200자 이내" />
                        <button className="btn primary" onClick={submitGuestbook}>댓글 등록</button>
                      </>
                    ) : (
                      <div className="login-notice">
                        <p className="meta">댓글 작성과 조회는 이메일 또는 구글 로그인 후 사용할 수 있습니다.</p>
                        <button className="btn primary" onClick={() => setPage("login")}>로그인하러 가기</button>
                      </div>
                    )}
                    {guestbookMsg && <p className="meta">{guestbookMsg}</p>}
                    {currentUser && (
                      <div className="comment-list">
                        {guestbookRows.length === 0 ? (
                          <p className="meta">아직 등록된 댓글이 없습니다.</p>
                        ) : (
                          guestbookRows.map((row) => (
                            <article className="comment-item" key={row.id}>
                              <div>
                                <p>{row.body}</p>
                                <span>{row.author} · {row.createdAt.toLocaleDateString("ko-KR")}</span>
                              </div>
                              {(row.authorUid ? row.authorUid === currentUserId : row.author === currentUser) && (
                                <button className="btn danger small" onClick={() => deleteMyComment(row)}>삭제</button>
                              )}
                            </article>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )}

                {detailTab === "results" && (
                  <section className="card-item response-panel">
                    <div className="head">
                      <h3>다른 사용자가 푼 빙고</h3>
                      {activeResponse && <button className="btn" onClick={restoreMyResult}>원본으로 돌아가기</button>}
                    </div>

                    <div className="response-list">
                      {responseRows.length === 0 ? (
                        <p className="meta">아직 등록된 풀이 결과가 없습니다.</p>
                      ) : (
                        responseRows.map((response) => (
                          <article className={`response-item ${activeResponse?.id === response.id ? "active" : ""}`} key={response.id}>
                            <div>
                              <strong>{response.nickname}</strong>
                              <span>체크 {response.checkedIndices.length}/9 · 빙고 {countBingoLines(response.checkedIndices)}줄 · {response.createdAt.toLocaleDateString("ko-KR")}</span>
                            </div>
                        <div className="response-actions">
                          <button className="btn" onClick={() => showResponseResult(response)}>{activeResponse?.id === response.id ? "보는 중" : "결과 보기"}</button>
                          {currentUserId && response.authorUid === currentUserId && (
                            <button className="btn danger" onClick={() => deleteMyResponse(response)}>내 결과 삭제</button>
                          )}
                        </div>
                      </article>
                        ))
                      )}
                    </div>
                  </section>
                )}
              </section>
            </div>
          </section>
        )}

        {page === "manage" && (
          <section className="panel manage-panel">
            <h2>관리</h2>
            {currentUser ? (
              <>
                <p className="meta">로그인한 계정으로 업로드한 빙고를 바로 관리할 수 있습니다.</p>
                {manageMsg && <p className="status info">{manageMsg}</p>}
                {myBoards.length === 0 ? (
                  <div className="login-notice manage-empty">
                    <p className="meta">아직 이 계정으로 업로드한 빙고가 없습니다.</p>
                    <button className="btn primary" onClick={() => setPage("maker")}>빙고 만들러 가기</button>
                  </div>
                ) : (
                  <div className="manage-list">
                    {myBoards.map((board) => (
                      <article className="card-item manage-card" key={board.id}>
                        <div className="board-mini-grid manage-thumb" aria-hidden="true">
                          {board.cells.map((cell, index) => (
                            <div className="board-mini-cell" key={`${board.id}-manage-${index}`}>
                              <CoverImage src={cell?.image} alt={cell?.title || ""} className="board-mini-cover" />
                            </div>
                          ))}
                        </div>

                        <div className="manage-content">
                          {editingBoardId === board.id ? (
                            <div className="manage-edit-form">
                              <input
                                className="field"
                                value={editBoardTitle}
                                onChange={(e) => setEditBoardTitle(e.target.value)}
                                placeholder="빙고 제목"
                              />
                              <input
                                className="field"
                                type="password"
                                value={editBoardPassword}
                                onChange={(e) => setEditBoardPassword(e.target.value)}
                                placeholder="관리 비밀번호 4자 이상"
                              />
                              <label className="visibility-control compact">
                                <input type="checkbox" checked={editBoardIsPublic} onChange={(e) => setEditBoardIsPublic(e.target.checked)} />
                                <span>
                                  <strong>공개 빙고</strong>
                                  <small>{editBoardIsPublic ? "메인 목록에 공개됩니다." : "링크 또는 관리에서만 확인합니다."}</small>
                                </span>
                              </label>
                              <div className="manage-actions">
                                <button className="btn primary" onClick={() => saveManagedBoard(board)}>저장</button>
                                <button className="btn" onClick={cancelManageEdit}>취소</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <h3>{board.title}</h3>
                                <p className="meta">조회 {board.views || 0}회 · {board.isPublic ? "공개" : "비공개"} · {board.createdAt}</p>
                                <p className="meta">ID: {board.id}</p>
                              </div>
                              <div className="manage-actions">
                                <div className="manage-action-row">
                                  <button className="btn primary" onClick={() => showBoardDetail(board)}>상세 보기</button>
                                  <button className="btn" onClick={() => startManageEdit(board)}>수정</button>
                                  <button className="btn danger" onClick={() => deleteBoardFromManage(board)}>삭제</button>
                                  <button className="btn" onClick={() => loadManageComments(board)}>댓글 관리</button>
                                </div>
                                <div className="manage-action-row">
                                  <button className="btn" onClick={() => copyShareLink(board, setManageMsg)}>링크 복사</button>
                                  <button className="btn" onClick={() => shareLink(board, setManageMsg)}>링크 공유</button>
                                  <button className="btn" onClick={() => downloadBoardImage(board, setManageMsg)}>사진 저장</button>
                                  <button className="btn" onClick={() => shareBoardImage(board, setManageMsg)}>사진 공유</button>
                                </div>
                              </div>
                              {manageCommentBoardId === board.id && (
                                <div className="manage-comment-box">
                                  <div className="head">
                                    <h4>댓글 관리</h4>
                                    <button className="btn small" onClick={() => { setManageCommentBoardId(""); setManageCommentRows([]); }}>닫기</button>
                                  </div>
                                  {manageCommentRows.length === 0 ? (
                                    <p className="meta">등록된 댓글이 없습니다.</p>
                                  ) : (
                                    <div className="manage-comment-list">
                                      {manageCommentRows.map((comment) => (
                                        <article className={`manage-comment-item ${comment.hidden ? "hidden" : ""}`} key={comment.id}>
                                          <div>
                                            <p>{comment.body}</p>
                                            <span>{comment.author} · {comment.createdAt.toLocaleDateString("ko-KR")} · {comment.hidden ? "숨김" : "표시 중"}</span>
                                          </div>
                                          <button className="btn" onClick={() => toggleCommentHidden(comment)}>{comment.hidden ? "숨김 해제" : "숨김"}</button>
                                        </article>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="meta">비회원으로 업로드한 빙고는 링크 또는 ID와 관리 비밀번호로 열 수 있습니다.</p>
                <div className="login-card manage-auth-card">
                  <input
                    className="field"
                    placeholder="빙고 링크 또는 ID"
                    value={manageBoardKey}
                    onChange={(e) => setManageBoardKey(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="관리 비밀번호"
                    type="password"
                    value={managePasswordInput}
                    onChange={(e) => setManagePasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openManagedBoard();
                    }}
                  />
                  <button className="btn primary full" onClick={openManagedBoard}>인증 확인</button>
                  {manageMsg && <p className="meta">{manageMsg}</p>}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {pickerOpen && (
        <div className="modal">
          <div className="backdrop" onClick={() => setPickerOpen(false)} />
          <div className="card modal-card">
            <h3>칸 {activeCellIndex + 1}</h3>
            <input
              className="field"
              placeholder="작품명/작가명 검색 (영어 or 일본어로 입력해주세요, 2글자 이상)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedSearchResult(null);
                setDisplayTitleInput("");
              }}
            />
            {isSearching && <p className="meta">검색 중...</p>}
            {searchError && <p className="meta">{searchError}</p>}
            <div className="mini-list">
              {visibleResults.map((x) => (
                <div key={`${x.title}-${x.id || "f"}`} className={`mini-item mini-btn ${selectedSearchResult?.id === x.id && selectedSearchResult?.title === x.title ? "selected" : ""}`}>
                  <CoverImage src={x.image} alt={x.title} className="mini-cover" />
                  <div><strong>{x.title}</strong>{x.synopsis && <span>{x.synopsis.slice(0, 70)}...</span>}</div>
                  <button className="btn small" onClick={() => selectSearchResult(x)}>
                    {selectedSearchResult?.id === x.id && selectedSearchResult?.title === x.title ? "선택됨" : "선택"}
                  </button>
                </div>
              ))}
            </div>

            <section className="search-register-box">
              {selectedSearchResult ? (
                <div className="selected-work">
                  <CoverImage src={selectedSearchResult.image} alt={selectedSearchResult.title} className="selected-cover" />
                  <div>
                    <span>선택한 작품</span>
                    <strong>{selectedSearchResult.title}</strong>
                  </div>
                </div>
              ) : (
                <p className="meta register-guide">검색 결과에서 작품을 먼저 선택해 주세요.</p>
              )}
              <input
                className="field"
                placeholder="화면에 표시할 한글 제목 (비워두면 원제 사용)"
                value={displayTitleInput}
                onChange={(e) => setDisplayTitleInput(e.target.value)}
              />
              <textarea
                className="field"
                rows="3"
                value={modalReview}
                onChange={(e) => setModalReview(e.target.value)}
                placeholder="이 작품을 선택한 이유나 감상평"
                maxLength="300"
              />
              <button className="btn primary full" onClick={registerSelectedResult} disabled={!selectedSearchResult}>이 내용으로 칸에 등록</button>
            </section>

            <button className="btn primary full" onClick={() => { setPickerOpen(false); setDirectInputOpen(true); }}>직접 입력 추가 열기</button>
            <button className="btn full" onClick={() => setPickerOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {directInputOpen && (
        <div className="modal">
          <div className="backdrop" onClick={() => setDirectInputOpen(false)} />
          <div className="card modal-card">
            <h3>직접 입력으로 추가</h3>
            <input className="field" value={directForm.title} onChange={(e) => setDirectForm((p) => ({ ...p, title: e.target.value }))} placeholder="작품명 (표시용)" />
            <input className="field" value={directForm.searchTitle} onChange={(e) => setDirectForm((p) => ({ ...p, searchTitle: e.target.value }))} placeholder="교보 검색어 (한글 추천)" />
            <input className="field" value={directForm.author} onChange={(e) => setDirectForm((p) => ({ ...p, author: e.target.value }))} placeholder="작가" />
            <input className="field" value={directForm.cover} onChange={(e) => setDirectForm((p) => ({ ...p, cover: e.target.value }))} placeholder="표지로 표시할 이미지 주소 URL (http/https)" />
            {directForm.cover.trim() && (
              <div className="cover-preview">
                <CoverImage src={directForm.cover.trim()} alt="표지 미리보기" className="selected-cover" />
                <span>표지 미리보기</span>
              </div>
            )}
            <textarea className="field" rows="3" value={directForm.synopsis} onChange={(e) => setDirectForm((p) => ({ ...p, synopsis: e.target.value }))} placeholder="줄거리" />
            <textarea className="field" rows="3" value={directForm.review} onChange={(e) => setDirectForm((p) => ({ ...p, review: e.target.value }))} placeholder="감상평" />
            <input className="field" value={directForm.kyoboUrl} onChange={(e) => setDirectForm((p) => ({ ...p, kyoboUrl: e.target.value }))} placeholder="교보문고 링크 URL (선택)" />
            <input className="field" value={directForm.ridiUrl} onChange={(e) => setDirectForm((p) => ({ ...p, ridiUrl: e.target.value }))} placeholder="리디북스 링크 URL (선택)" />
            <button className="btn primary full" onClick={applyDirectForm}>추가</button>
            <button className="btn full" onClick={() => setDirectInputOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
