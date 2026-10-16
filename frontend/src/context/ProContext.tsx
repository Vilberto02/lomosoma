import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { SummitStamp } from "../types";
import {
  listOfflinePackIds,
  getSummitStamps,
  saveSummitStamp,
} from "../services/offlineStorage";
import { downloadOfflinePack } from "../services/api";
import toast from "react-hot-toast";

interface ProContextType {
  unlockedLomaIds: string[];
  hasFullLimaPack: boolean;
  offlinePackIds: string[];
  summitStamps: SummitStamp[];
  isUpgradeModalOpen: boolean;
  upgradeTargetLomaId: string | null;
  isLomaProUnlocked: (lomaId: string) => boolean;
  openUpgradeModal: (targetLomaId?: string) => void;
  closeUpgradeModal: () => void;
  unlockLoma: (lomaId: string) => void;
  unlockFullLimaPack: () => void;
  downloadOfflinePackForLoma: (lomaId: string) => Promise<boolean>;
  refreshOfflinePacks: () => Promise<void>;
  refreshSummitStamps: () => Promise<void>;
  addSummitStamp: (stamp: SummitStamp) => Promise<void>;
}

const ProContext = createContext<ProContextType | null>(null);

const STORAGE_KEY_UNLOCKED = "lomosoma_unlocked_lomas";
const STORAGE_KEY_FULL_PACK = "lomosoma_has_full_pack";

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unlockedLomaIds, setUnlockedLomaIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_UNLOCKED);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && !parsed.includes("L0")) {
          parsed.push("L0");
        }
        return parsed;
      }
    } catch {
      return ["L0"];
    }
    return ["L0"];
  });

  const [hasFullLimaPack, setHasFullLimaPack] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_FULL_PACK) === "true";
    } catch {
      return false;
    }
  });

  const [offlinePackIds, setOfflinePackIds] = useState<string[]>([]);
  const [summitStamps, setSummitStamps] = useState<SummitStamp[]>([]);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeTargetLomaId, setUpgradeTargetLomaId] = useState<string | null>(null);

  const refreshOfflinePacks = useCallback(async () => {
    try {
      const ids = await listOfflinePackIds();
      setOfflinePackIds(ids);
    } catch {
      return;
    }
  }, []);

  const refreshSummitStamps = useCallback(async () => {
    try {
      const stamps = await getSummitStamps();
      setSummitStamps(stamps);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    refreshOfflinePacks();
    refreshSummitStamps();
  }, [refreshOfflinePacks, refreshSummitStamps]);

  const isLomaProUnlocked = useCallback(
    (lomaId: string): boolean => {
      if (lomaId === "L0") return true;
      if (hasFullLimaPack) return true;
      return unlockedLomaIds.includes(lomaId);
    },
    [hasFullLimaPack, unlockedLomaIds]
  );

  const openUpgradeModal = useCallback((targetLomaId?: string) => {
    setUpgradeTargetLomaId(targetLomaId ?? null);
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setUpgradeTargetLomaId(null);
  }, []);

  const unlockLoma = useCallback((lomaId: string) => {
    setUnlockedLomaIds((prev) => {
      if (prev.includes(lomaId)) return prev;
      const next = [...prev, lomaId];
      try {
        localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  const unlockFullLimaPack = useCallback(() => {
    setHasFullLimaPack(true);
    try {
      localStorage.setItem(STORAGE_KEY_FULL_PACK, "true");
    } catch {
      return;
    }
  }, []);

  const downloadOfflinePackForLoma = useCallback(
    async (lomaId: string): Promise<boolean> => {
      try {
        toast.loading("Descargando maletin offline...", { id: `download-${lomaId}` });
        await downloadOfflinePack(lomaId);
        await refreshOfflinePacks();
        toast.success("Maletin offline descargado con exito", { id: `download-${lomaId}` });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error al descargar maletin";
        toast.error(message, { id: `download-${lomaId}` });
        return false;
      }
    },
    [refreshOfflinePacks]
  );

  const addSummitStamp = useCallback(
    async (stamp: SummitStamp): Promise<void> => {
      await saveSummitStamp(stamp);
      await refreshSummitStamps();
    },
    [refreshSummitStamps]
  );

  const value = useMemo(
    () => ({
      unlockedLomaIds,
      hasFullLimaPack,
      offlinePackIds,
      summitStamps,
      isUpgradeModalOpen,
      upgradeTargetLomaId,
      isLomaProUnlocked,
      openUpgradeModal,
      closeUpgradeModal,
      unlockLoma,
      unlockFullLimaPack,
      downloadOfflinePackForLoma,
      refreshOfflinePacks,
      refreshSummitStamps,
      addSummitStamp,
    }),
    [
      unlockedLomaIds,
      hasFullLimaPack,
      offlinePackIds,
      summitStamps,
      isUpgradeModalOpen,
      upgradeTargetLomaId,
      isLomaProUnlocked,
      openUpgradeModal,
      closeUpgradeModal,
      unlockLoma,
      unlockFullLimaPack,
      downloadOfflinePackForLoma,
      refreshOfflinePacks,
      refreshSummitStamps,
      addSummitStamp,
    ]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
};

export function usePro(): ProContextType {
  const ctx = useContext(ProContext);
  if (!ctx) {
    throw new Error("usePro must be used within a ProProvider");
  }
  return ctx;
}
