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
import { jsonApi, readSession, type AccountUser } from "../services/http";

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
  user: AccountUser | null;
  accountLoading: boolean;
  refreshAccount: () => Promise<void>;
  downloadOfflinePackForLoma: (lomaId: string) => Promise<boolean>;
  refreshOfflinePacks: () => Promise<void>;
  refreshSummitStamps: () => Promise<void>;
  addSummitStamp: (stamp: SummitStamp) => Promise<void>;
}

const ProContext = createContext<ProContextType | null>(null);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unlockedLomaIds, setUnlockedLomaIds] = useState<string[]>(["L0"]);
  const [hasFullLimaPack, setHasFullLimaPack] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const refreshAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const session = await readSession();
      setUser(session.user);
      if (session.user) {
        const rights = await jsonApi<{ all_lima: boolean; loma_ids: string[] }>("/billing/entitlements");
        setUnlockedLomaIds(rights.loma_ids);
        setHasFullLimaPack(rights.all_lima);
      } else {
        setUnlockedLomaIds(["L0"]);
        setHasFullLimaPack(false);
      }
    } catch (error) {
      setUser(null);
      setUnlockedLomaIds(["L0"]);
      setHasFullLimaPack(false);
      throw error;
    } finally { setAccountLoading(false); }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("lomosoma_unlocked_lomas");
      localStorage.removeItem("lomosoma_has_full_pack");
    } catch { /* Storage may be disabled; it is never an authority for purchases. */ }
    void refreshAccount().catch(() => {});
  }, [refreshAccount]);

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
      if (!navigator.onLine && offlinePackIds.includes(lomaId)) return true;
      if (hasFullLimaPack) return true;
      return unlockedLomaIds.includes(lomaId);
    },
    [hasFullLimaPack, unlockedLomaIds, offlinePackIds]
  );

  const openUpgradeModal = useCallback((targetLomaId?: string) => {
    setUpgradeTargetLomaId(targetLomaId ?? null);
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setUpgradeTargetLomaId(null);
  }, []);

  const downloadOfflinePackForLoma = useCallback(
    async (lomaId: string): Promise<boolean> => {
      try {
        toast.loading("Descargando maletín offline...", { id: `download-${lomaId}` });
        await downloadOfflinePack(lomaId);
        await refreshOfflinePacks();
        toast.success("Maletín offline descargado con éxito", { id: `download-${lomaId}` });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error al descargar maletín";
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
      user,
      accountLoading,
      refreshAccount,
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
      user,
      accountLoading,
      refreshAccount,
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
