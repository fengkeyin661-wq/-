
import React, { useState, useEffect, useCallback } from 'react';
import { UserLayout } from './UserLayout';
import { UserHabits } from './UserHabits';
import { UserInteraction } from './UserInteraction';
import { UserProfile } from './UserProfile';
import { UserProfileShell } from './UserProfileShell';
import { UserCommunity } from './UserCommunity';
import { UserDoctors } from './UserDoctors';
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly, syncArchiveToLocal } from '../../services/dataService';
import { getUnreadCount } from '../../services/contentService';

const USER_SESSION_CHECKUP_KEY = 'user_portal_checkup_id';

interface Props {
  /** 主域名入口登录后传入的体检编号 */
  initialCheckupId?: string;
  /** 主域名聚合入口退出时清空 App 侧状态；子域名访客模式可不传 */
  onLogout?: () => void;
}

export const UserApp: React.FC<Props> = ({ initialCheckupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('message');
  const [loading, setLoading] = useState(true);
  const [userArchive, setUserArchive] = useState<HealthArchive | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const refreshUnreadCount = useCallback(async () => {
    if (!userArchive) return;
    const count = await getUnreadCount(userArchive.checkup_id);
    setUnreadCount(count);
  }, [userArchive?.checkup_id]);

  const resolvedUserName =
    userArchive?.name?.trim() || userArchive?.health_record?.profile?.name?.trim() || '用户';

  const profileIncompleteBanner =
    userArchive && userArchive.profile_complete === false
      ? '您的个人健康档案尚未完善，请联系健康管家完成健康档案建档。'
      : null;

  const persistSessionCheckupId = (checkupId: string) => {
    try {
      sessionStorage.setItem(USER_SESSION_CHECKUP_KEY, checkupId);
    } catch {
      /* ignore */
    }
  };

  const clearSessionCheckupId = () => {
    try {
      sessionStorage.removeItem(USER_SESSION_CHECKUP_KEY);
    } catch {
      /* ignore */
    }
  };

  const loadArchiveById = useCallback(
    async (checkupId: string, isSilent = false, showAlertOnMissing = false) => {
      if (!isSilent) setLoading(true);
      try {
        const archive = await findArchiveByCheckupId(checkupId);
        if (archive) {
          setUserArchive(archive);
          syncArchiveToLocal(archive);
          persistSessionCheckupId(archive.checkup_id);
        } else {
          setUserArchive(null);
          clearSessionCheckupId();
          if (showAlertOnMissing) {
            alert('未找到您的档案，请联系管理员核对体检编号');
          }
        }
      } catch (e) {
        console.error(e);
        setUserArchive(null);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const bootstrap = async () => {
      const fromProp = initialCheckupId?.trim();
      let fromSession = '';
      try {
        fromSession = sessionStorage.getItem(USER_SESSION_CHECKUP_KEY) || '';
      } catch {
        fromSession = '';
      }
      const id = fromProp || fromSession;
      if (id) {
        await loadArchiveById(id, false, !!fromProp && !fromSession);
      } else {
        setLoading(false);
        setUserArchive(null);
      }
    };
    bootstrap();
  }, [initialCheckupId, loadArchiveById]);

  useEffect(() => {
    if (userArchive) {
      refreshUnreadCount();
      const interval = setInterval(refreshUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [userArchive?.checkup_id, refreshUnreadCount]);

  useEffect(() => {
    if (!userArchive?.checkup_id) return;
    const interval = setInterval(() => {
      loadArchiveById(userArchive.checkup_id, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [userArchive?.checkup_id, loadArchiveById]);

  const handleUpdateRecord = async (updatedData: any) => {
    if (!userArchive) return;

    const newCheckup = {
      ...userArchive.health_record.checkup,
      basics: { ...userArchive.health_record.checkup.basics, ...updatedData.basics },
      labBasic: {
        ...userArchive.health_record.checkup.labBasic,
        ...updatedData.labBasic,
        lipids: {
          ...userArchive.health_record.checkup.labBasic.lipids,
          ...(updatedData.labBasic?.lipids || {}),
        },
        glucose: {
          ...userArchive.health_record.checkup.labBasic.glucose,
          ...(updatedData.labBasic?.glucose || {}),
        },
      },
    };

    const newRecord = {
      ...userArchive.health_record,
      checkup: newCheckup,
      riskModelExtras: {
        ...(userArchive.health_record.riskModelExtras || {}),
        ...(updatedData.riskModelExtras || {}),
      },
    };
    setUserArchive({ ...userArchive, health_record: newRecord });

    try {
      await updateHealthRecordOnly(userArchive.checkup_id, newRecord);
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  const handleProfileLogout = () => {
    clearSessionCheckupId();
    setUserArchive(null);
    setUnreadCount(0);
    setActiveTab('habits');
    onLogout?.();
  };

  const handleShellLoginSuccess = async (archive: HealthArchive) => {
    setUserArchive(archive);
    syncArchiveToLocal(archive);
    persistSessionCheckupId(archive.checkup_id);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">正在加载...</p>
      </div>
    );
  }

  return (
    <UserLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      unreadCount={unreadCount}
      profileIncompleteBanner={profileIncompleteBanner}
    >
      {activeTab === 'habits' && (
        <UserHabits
          assessment={userArchive?.assessment_data}
          userCheckupId={userArchive?.checkup_id}
          userName={userArchive ? resolvedUserName : '访客'}
          record={userArchive?.health_record}
          onRefresh={() => userArchive && loadArchiveById(userArchive.checkup_id, true)}
        />
      )}
      {activeTab === 'community' && (
        <UserCommunity
          userId={userArchive?.checkup_id}
          userName={userArchive ? resolvedUserName : undefined}
          assessment={userArchive?.assessment_data}
        />
      )}
      {activeTab === 'doctor' && (
        <UserDoctors
          userId={userArchive?.checkup_id}
          userName={userArchive ? resolvedUserName : undefined}
          archive={userArchive ?? undefined}
          onOpenMessage={(_doctorId) => {
            setActiveTab('message');
          }}
        />
      )}
      {activeTab === 'message' && (
        <UserInteraction
          userId={userArchive?.checkup_id}
          userName={userArchive ? resolvedUserName : undefined}
          archive={userArchive ?? undefined}
          assessment={userArchive?.assessment_data}
          onMessageRead={refreshUnreadCount}
          onOpenDoctors={() => setActiveTab('doctor')}
          onOpenCommunity={() => setActiveTab('community')}
        />
      )}
      {activeTab === 'profile' &&
        (userArchive ? (
          <UserProfile
            record={userArchive.health_record}
            assessment={userArchive.assessment_data}
            dailyPlan={userArchive.custom_daily_plan}
            userId={userArchive.checkup_id}
            archive={userArchive}
            onUpdateRecord={handleUpdateRecord}
            onLogout={handleProfileLogout}
            onNavigate={setActiveTab}
            onArchiveRefresh={() =>
              userArchive && loadArchiveById(userArchive.checkup_id, true)
            }
          />
        ) : (
          <UserProfileShell onLoginSuccess={handleShellLoginSuccess} />
        ))}
    </UserLayout>
  );
};
