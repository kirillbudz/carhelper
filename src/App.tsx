// === Глобальные константы и контекст Telegram ===
const TG_ID = Number(import.meta.env.VITE_TEST_TG_ID || 2030478965);
const API = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function tgCtx() {
  return {
    initData: 'TEST_BYPASS',
    user: { id: TG_ID },
  };
}

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import WebApp from '@twa-dev/sdk';

// === Типы ===
type SessionState = 'idle' | 'req_title' | 'req_photo' | 'req_desc' | 'req_confirm';
type RoleDb = 'client' | 'vendor';
type UIRole = 'user' | 'vendor';

type InitData = {
  success?: boolean;
  data?: {
    role?: RoleDb;
    session?: { state?: SessionState; payload?: any };
    vehicles?: any[];
    subscription_active?: boolean;
    subscription?: any;
    categories?: Array<{ group: string; code: string; label: string }>;
  };
};

const LS_ROLE_KEY = 'ch_role';

export default function App() {
  const [phase, setPhase] = useState<'choose_role' | 'loading' | 'ready'>('choose_role');
  const [uiRole, setUiRole] = useState<UIRole | null>(null);
  const [init, setInit] = useState<InitData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // внутренние экраны после init
  const [screen, setScreen] = useState<'home' | 'garage' | 'garage_add' | 'requests' | 'req_category'>('home');

  // состояние гаража
  const [garageLoading, setGarageLoading] = useState(false);
  const [garageError, setGarageError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  // мои заявки
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);

  // выбранная категория перед стартом заявки
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // форма добавления автомобиля
  const [fMake, setFMake] = useState('');
  const [fModel, setFModel] = useState('');
  const [fYear, setFYear] = useState<number | ''>('');
  const [fVin, setFVin] = useState('');
  const [fChassis, setFChassis] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // форма заголовка заявки
  const [fTitle, setFTitle] = useState('');
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // форма фото заявки (временно вводим file_id вручную)
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [photosBusy, setPhotosBusy] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);

  // форма описания заявки
  const [fDesc, setFDesc] = useState('');
  const [descBusy, setDescBusy] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  // подтверждение заявки
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // === lifecycle (с защитой от StrictMode двойного вызова) ===
  const didBoot = useRef(false);
  useEffect(() => {
    if (didBoot.current) return;
    didBoot.current = true;

    WebApp.ready();
    const saved = localStorage.getItem(LS_ROLE_KEY) as UIRole | null;
    if (saved === 'user' || saved === 'vendor') {
      setUiRole(saved);
      setPhase('loading');
      callInit(saved, { withGarageCheck: true });
    }
  }, []);

  // === Инициализация (с опцией проверки гаража только при первичном входе) ===
  async function callInit(
    roleForUi: UIRole,
    opts: { withGarageCheck?: boolean } = {}
  ) {
    const { withGarageCheck = false } = opts;
    try {
      setError(null);
      const url = `${API}/miniapp/init`;
      const res = await axios.post<InitData>(url, {
        ...tgCtx(),
        role: roleForUi === 'user' ? 'client' : 'vendor',
      });

      setInit(res.data);

      if (roleForUi === 'user' && withGarageCheck) {
        try {
          const gl = await axios.post(`${API}/miniapp/garage/list`, tgCtx());
          const list = gl.data?.data?.vehicles ?? [];
          setVehicles(list);
          setScreen(list.length === 0 ? 'garage_add' : 'home');
        } catch {
          const vInit = res.data?.data?.vehicles ?? [];
          setVehicles(vInit);
          setScreen(vInit.length === 0 ? 'garage_add' : 'home');
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Init failed');
    } finally {
      setPhase('ready');
    }
  }

  // === Выбор/сброс роли ===
  const chooseRole = (r: UIRole) => {
    setUiRole(r);
    localStorage.setItem(LS_ROLE_KEY, r);
    setPhase('loading');
    callInit(r, { withGarageCheck: true });
  };

  const resetRole = () => {
    localStorage.removeItem(LS_ROLE_KEY);
    setUiRole(null);
    setInit(null);
    setError(null);
    setScreen('home');
    setPhase('choose_role');
  };

  // ---- Гараж: /miniapp/garage/list ----
  async function openGarage() {
    setGarageLoading(true);
    setGarageError(null);
    setScreen('garage');
    try {
      const res = await axios.post(`${API}/miniapp/garage/list`, tgCtx());
      const list = res.data?.data?.vehicles ?? [];
      setVehicles(list);
    } catch (e: any) {
      setGarageError(e?.response?.data?.error || e.message || 'Garage list failed');
      setVehicles([]);
    } finally {
      setGarageLoading(false);
    }
  }

  // ---- Клиент: /miniapp/requests/list ----
  async function openRequests() {
    setReqLoading(true);
    setReqError(null);
    setScreen('requests');
    try {
      const res = await axios.post(`${API}/miniapp/requests/list`, tgCtx());
      const list = res.data?.data?.requests ?? res.data?.requests ?? [];
      setMyRequests(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setReqError(e?.response?.data?.error || e.message || 'Не удалось загрузить заявки');
      setMyRequests([]);
    } finally {
      setReqLoading(false);
    }
  }

  // ---- Заявка: /miniapp/request/start ----
  async function startRequest(categoryValue?: string) {
    try {
      const categories = init?.data?.categories || [];
      // если явно не передали — пробуем из selectedCat или первый из списка
      const cat =
        categoryValue ||
        selectedCat ||
        (categories[0] ? `${categories[0].group}:${categories[0].code}` : 'service:other');

      await axios.post(`${API}/miniapp/request/start`, {
        ...tgCtx(),
        category: cat,
      });

      // после создания заявки обновим init, чтобы отобразить состояние мастера
      if (uiRole) {
        setPhase('loading');
        await callInit(uiRole);
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || 'Не удалось начать заявку');
    }
  }

  // ---- Гараж: /miniapp/garage/add ----
  async function addVehicle() {
    setAddBusy(true);
    setAddError(null);
    try {
      const vehicle = {
        make: nullIfEmpty(fMake),
        model: nullIfEmpty(fModel),
        year: fYear === '' ? null : Number(fYear),
        vin: nullIfEmpty(fVin),
        chassis: nullIfEmpty(fChassis),
        is_active: true,
        set_active: true,
      };

      const body = { ...tgCtx(), ...vehicle, data: vehicle };

      await axios.post(`${API}/miniapp/garage/add`, body);

      // обычный успех
      setScreen('garage');
      await openGarage();
      setFMake(''); setFModel(''); setFYear(''); setFVin(''); setFChassis('');
    } catch (e: any) {
      const status = e?.response?.status;
      const dbg = e?.response?.data?.data?.debug || e?.response?.data?.debug;

      // ХАК: нода может вернуть 422, но вставка произошла -> считаем успехом
      if (status === 422 && dbg) {
        setScreen('garage');
        await openGarage();
        setFMake(''); setFModel(''); setFYear(''); setFVin(''); setFChassis('');
        return;
      }

      // реальная ошибка
      setAddError(e?.response?.data?.error || e.message || 'Garage add failed');
    } finally {
      setAddBusy(false);
    }
  }

  // ---- Заявка: /miniapp/request/title ----
  async function saveTitle() {
    if (!fTitle.trim()) {
      setTitleError('Введите заголовок');
      return;
    }
    setTitleBusy(true);
    setTitleError(null);
    try {
      await axios.post(`${API}/miniapp/request/title`, {
        ...tgCtx(),
        title: fTitle.trim(),
      });
      // после сохранения заголовка перечитываем init (должен стать req_photo)
      if (uiRole) {
        setPhase('loading');
        await callInit(uiRole); // без withGarageCheck
      }
    } catch (e: any) {
      setTitleError(e?.response?.data?.error || e.message || 'Не удалось сохранить заголовок');
    } finally {
      setTitleBusy(false);
    }
  }

  // ---- Заявка: /miniapp/request/photos ----
  function addPhotoId() {
    const v = photoInput.trim();
    if (!v) return;
    setPhotoIds(prev => Array.from(new Set([...prev, v])));
    setPhotoInput('');
  }

  function removePhotoId(v: string) {
    setPhotoIds(prev => prev.filter(x => x !== v));
  }

  async function savePhotos() {
    if (photoIds.length === 0) {
      setPhotosError('Добавьте хотя бы один file_id фото');
      return;
    }
    setPhotosBusy(true);
    setPhotosError(null);
    try {
      await axios.post(`${API}/miniapp/request/photos`, {
        ...tgCtx(),
        photos: photoIds.map(id => ({ file_id: id })),
      });
      if (uiRole) {
        setPhase('loading');
        await callInit(uiRole);
      }
    } catch (e: any) {
      setPhotosError(e?.response?.data?.error || e.message || 'Не удалось сохранить фото');
    } finally {
      setPhotosBusy(false);
    }
  }

  // NEW: пропуск фотографий
  async function skipPhotos() {
    setPhotosBusy(true);
    setPhotosError(null);
    try {
      // отправляем пустой список фото — ожидаем переход мастера на req_desc
      await axios.post(`${API}/miniapp/request/photos`, {
        ...tgCtx(),
        photos: [],
      });
      if (uiRole) {
        setPhase('loading');
        await callInit(uiRole);
      }
      // локально подчистим список
      setPhotoIds([]);
    } catch (e: any) {
      setPhotosError(e?.response?.data?.error || e.message || 'Не удалось пропустить фото');
    } finally {
      setPhotosBusy(false);
    }
  }

  // ---- Заявка: /miniapp/request/desc ----
  async function saveDesc() {
    if (!fDesc.trim()) {
      setDescError('Введите описание');
      return;
    }
    setDescBusy(true);
    setDescError(null);
    try {
      await axios.post(`${API}/miniapp/request/desc`, {
        ...tgCtx(),
        desc: fDesc.trim(),
      });
      if (uiRole) {
        setPhase('loading');
        await callInit(uiRole);
      }
    } catch (e: any) {
      setDescError(e?.response?.data?.error || e.message || 'Не удалось сохранить описание');
    } finally {
      setDescBusy(false);
    }
  }

  // ---- Заявка: /miniapp/request/confirm ----
  async function handleConfirm() {
    try {
      await axios.post(`${API}/miniapp/request/confirm`, tgCtx());
      await callInit('user'); // обновим init с новыми заявками
      // локально сбросим мастер
      setInit(prev => {
        const cur = prev ?? { data: {} as any };
        return {
          ...cur,
          data: {
            ...cur.data,
            session: { state: 'idle', payload: null },
          },
        } as any;
      });
      setScreen('requests'); // сразу открываем Мои заявки
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Ошибка при отправке заявки');
    }
  }

  // ---- Заявка: /miniapp/request/cancel ----
  async function cancelRequestAndBack() {
    try {
      await axios.post(`${API}/miniapp/request/cancel`, tgCtx());
      setInit(prev => {
        const cur = prev ?? { data: {} as any };
        return {
          ...cur,
          data: {
            ...cur.data,
            session: { state: 'idle', payload: null },
          },
        } as any;
      });
      setScreen('home');
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || 'Не удалось отменить заявку');
    }
  }

  // === вычисления из init ===
  const step = init?.data?.session?.state as SessionState | undefined;
  const subActive = !!init?.data?.subscription_active;

  const reqPayload = (init?.data?.session?.payload?.request ??
                     init?.data?.session?.payload ??
                     {}) as any;

  // ====== UI ======

  // выбор роли
  if (phase === 'choose_role' || !uiRole) {
    return (
      <div style={wrap}>
        <h2 style={h2}>CarHelper</h2>
        <div style={{ marginTop: 10, opacity: 0.8 }}>Кто вы?</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <button style={btn} onClick={() => chooseRole('user')}>Я пользователь</button>
          <button style={btn} onClick={() => chooseRole('vendor')}>Я вендор</button>
        </div>
      </div>
    );
  }

  // лоадер
  if (phase === 'loading') {
    return (
      <div style={wrap}>
        <Header role={uiRole} onReset={resetRole} />
        <div style={{ marginTop: 8, opacity: 0.7 }}>Загрузка…</div>
      </div>
    );
  }

  // ошибка
  if (error) {
    return (
      <div style={wrap}>
        <Header role={uiRole} onReset={resetRole} />
        <pre style={errorStyle}>{error}</pre>
        <button style={btn} onClick={() => callInit(uiRole)}>Повторить</button>
      </div>
    );
  }

  // Незавершённый мастер — интерактив
  if (step && step !== 'idle') {
    // Шаг 1: Заголовок
    if (step === 'req_title') {
      return (
        <div style={wrap}>
          <Header role={uiRole!} onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Шаг 1 из 4 — Заголовок заявки</h3>
          {reqPayload?.category_label && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>Категория: {reqPayload.category_label}</div>
          )}

          <div style={{ display: 'grid', gap: 10, marginTop: 12, maxWidth: 520 }}>
            <Field label="Заголовок">
              <input
                style={input}
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="Например: Вмятина на крыле, нужна рихтовка"
              />
            </Field>

            {titleError && <pre style={errorStyle}>{titleError}</pre>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btn} onClick={saveTitle} disabled={titleBusy}>
                {titleBusy ? 'Сохранение…' : '💾 Сохранить заголовок'}
              </button>
              <button style={btn} onClick={() => setFTitle('')}>Очистить</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <button style={btn} onClick={cancelRequestAndBack}>⬅️ Назад</button>
            </div>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary>init</summary>
            <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
          </details>
        </div>
      );
    }

    // Шаг 2: Фото
    if (step === 'req_photo') {
      return (
        <div style={wrap}>
          <Header role={uiRole!} onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Шаг 2 из 4 — Фото</h3>
          {reqPayload?.category_label && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>Категория: {reqPayload.category_label}</div>
          )}

          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
            Временно вводим <code>file_id</code> фотографий из Telegram вручную. Позже подключим выбор/загрузку.
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 12, maxWidth: 520 }}>
            <Field label="Добавить file_id">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...input, flex: 1 }}
                  value={photoInput}
                  onChange={(e) => setPhotoInput(e.target.value)}
                  placeholder="например: AgACAgIAAxkBAANtZ..."
                />
                <button style={btn} onClick={addPhotoId}>Добавить</button>
              </div>
            </Field>

            {photoIds.length > 0 && (
              <div style={{ ...card, background: '#121212' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Фото (file_id):</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {photoIds.map(id => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 12, opacity: 0.9, wordBreak: 'break-all' }}>{id}</code>
                      <button style={btnSmall} onClick={() => removePhotoId(id)}>Удалить</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photosError && <pre style={errorStyle}>{photosError}</pre>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btn} onClick={savePhotos} disabled={photosBusy}>
                {photosBusy ? 'Сохранение…' : '💾 Сохранить фото'}
              </button>
              <button style={btn} onClick={skipPhotos} disabled={photosBusy}>
                ⏭️ Пропустить
              </button>
              <button style={btn} onClick={() => setPhotoIds([])} disabled={photosBusy}>
                Очистить список
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <button style={btn} onClick={cancelRequestAndBack}>⬅️ Назад</button>
            </div>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary>init</summary>
            <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
          </details>
        </div>
      );
    }

    // Шаг 3: Описание
    if (step === 'req_desc') {
      return (
        <div style={wrap}>
          <Header role={uiRole!} onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Шаг 3 из 4 — Описание</h3>
          {reqPayload?.category_label && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>Категория: {reqPayload.category_label}</div>
          )}

          <div style={{ display: 'grid', gap: 10, marginTop: 12, maxWidth: 520 }}>
            <Field label="Опишите проблему">
              <textarea
                style={{ ...input, minHeight: 100, resize: 'vertical' }}
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
                placeholder="Например: после ДТП вмятина на переднем крыле, нужно рихтовать и покрасить."
              />
            </Field>

            {descError && <pre style={errorStyle}>{descError}</pre>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btn} onClick={saveDesc} disabled={descBusy}>
                {descBusy ? 'Сохранение…' : '💾 Сохранить описание'}
              </button>
              <button style={btn} onClick={() => setFDesc('')}>Очистить</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <button style={btn} onClick={cancelRequestAndBack}>⬅️ Назад</button>
            </div>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary>init</summary>
            <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
          </details>
        </div>
      );
    }

    // Шаг 4: Подтверждение
    if (step === 'req_confirm') {
      const payload = init?.data?.session?.payload || {};
      const request = payload.request ?? payload ?? {};
      const v =
        init?.data?.vehicles?.find((veh: any) => veh.id === request.vehicle_id) ||
        payload.vehicle ||
        {};

      return (
        <div style={wrap}>
          <Header role={uiRole!} onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Шаг 4 из 4 — Подтверждение</h3>
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            Проверьте все данные по заявке. Если всё верно — нажмите <b>«Отправить заявку»</b>.
          </div>

          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{request.title || 'Без заголовка'}</div>

            {v.make && (
              <div style={{ marginTop: 4, opacity: 0.9 }}>
                🚗 {v.make} {v.model} {v.year ? `(${v.year})` : ''}{' '}
                {v.vin ? `· VIN: ${v.vin}` : ''}
              </div>
            )}

            {request.category_label && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                🧰 Категория: {request.category_label}
              </div>
            )}

            {request.description && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>{request.description}</div>
            )}
          </div>

          {confirmError && <pre style={errorStyle}>{confirmError}</pre>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={btn} onClick={handleConfirm}>
              ✅ Отправить заявку
            </button>
            <button style={btn} onClick={cancelRequestAndBack}>⬅️ Назад</button>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary>init</summary>
            <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
          </details>
        </div>
      );
    }

    // Остальные шаги
    return (
      <div style={wrap}>
        <Header role={uiRole!} onReset={resetRole} />
        <div style={{ marginTop: 8 }}>Продолжим шаг: <b>{mapStep(step)}</b></div>
        <details style={{ marginTop: 12 }}>
          <summary>init</summary>
          <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
        </details>
      </div>
    );
  }

  // ---- USER ----
  if (uiRole === 'user') {
    if (screen === 'requests') {
      return (
        <div style={wrap}>
          <Header role="user" onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Мои заявки</h3>

          {reqLoading && <div style={{ opacity: 0.7 }}>Загрузка…</div>}
          {reqError && <pre style={errorStyle}>{reqError}</pre>}

          {!reqLoading && !reqError && (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {myRequests.length === 0 ? (
                <div style={{ opacity: 0.8 }}>Пока заявок нет.</div>
              ) : (
                myRequests.map((r: any) => (
                  <div key={r.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, marginRight: 8 }}>{r.title || 'Без заголовка'}</div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>{statusLabel(r.status)}</div>
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.95, marginTop: 6 }}>
                      🚗 {carLabel(r)}
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                      Категория: {r.category_label || r.category_code || '—'}
                    </div>

                    {r.desc && (
                      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                        {r.desc}
                      </div>
                    )}

                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      Создано: {fmtDate(r.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={btn} onClick={() => setScreen('home')}>⬅️ Назад</button>
          </div>
        </div>
      );
    }

    if (screen === 'garage') {
      return (
        <div style={wrap}>
          <Header role="user" onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Гараж</h3>

          {garageLoading && <div style={{ opacity: 0.7 }}>Загрузка списка…</div>}
          {garageError && <pre style={errorStyle}>{garageError}</pre>}

          {!garageLoading && !garageError && (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {vehicles.length === 0 ? (
                <div style={{ opacity: 0.8 }}>Пока нет автомобилей.</div>
              ) : (
                vehicles.map((v: any) => (
                  <div key={v.id} style={card}>
                    <div style={{ fontWeight: 600 }}>
                      {v.make || 'Марка'} {v.model || ''} {v.year ? `(${v.year})` : ''}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 14 }}>
                      VIN: {v.vin || '—'} · Кузов: {v.chassis || '—'} · Активен: {String(v.is_active)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={btn} onClick={() => setScreen('garage_add')}>➕ Добавить авто</button>
            <button style={btn} onClick={() => setScreen('home')}>⬅️ Назад</button>
          </div>
        </div>
      );
    }

    if (screen === 'garage_add') {
      return (
        <div style={wrap}>
          <Header role="user" onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Добавить авто</h3>

          <div style={{ display: 'grid', gap: 10, marginTop: 10, maxWidth: 480 }}>
            <Field label="Марка">
              <input style={input} value={fMake} onChange={e => setFMake(e.target.value)} placeholder="Kia" />
            </Field>
            <Field label="Модель">
              <input style={input} value={fModel} onChange={e => setFModel(e.target.value)} placeholder="Cerato" />
            </Field>
            <Field label="Год">
              <input
                style={input}
                value={fYear}
                onChange={e => setFYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="2016"
                inputMode="numeric"
              />
            </Field>
            <Field label="VIN">
              <input style={input} value={fVin} onChange={e => setFVin(e.target.value)} placeholder="JTDK..." />
            </Field>
            <Field label="Кузов">
              <input style={input} value={fChassis} onChange={e => setFChassis(e.target.value)} placeholder="FD" />
            </Field>

            {addError && <pre style={errorStyle}>{addError}</pre>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btn} onClick={addVehicle} disabled={addBusy}>
                {addBusy ? 'Сохранение…' : '💾 Сохранить'}
              </button>
              <button style={btn} onClick={() => setScreen('garage')}>⬅️ Отмена</button>
            </div>
          </div>
        </div>
      );
    }

    // Новый экран: выбор категории
    if (screen === 'req_category') {
      const cats = init?.data?.categories || [];

      return (
        <div style={wrap}>
          <Header role="user" onReset={resetRole} />
          <h3 style={{ marginTop: 12 }}>Выберите категорию</h3>

          {cats.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Категории не получены. Попробуйте ещё раз или начните без выбора.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {cats.map((c) => {
                const val = `${c.group}:${c.code}`;
                const checked = selectedCat === val;
                return (
                  <label
                    key={val}
                    style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="cat"
                      checked={checked}
                      onChange={() => setSelectedCat(val)}
                      style={{ accentColor: '#fff' } as any}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.label}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {c.group} · {c.code}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              style={btn}
              onClick={() => startRequest(selectedCat || 'service:other')}
              disabled={cats.length === 0}
            >
              ✅ Продолжить
            </button>
            <button style={btn} onClick={() => setScreen('home')}>⬅️ Назад</button>
          </div>
        </div>
      );
    }

    // user/home
    return (
      <div style={wrap}>
        <Header role="user" onReset={resetRole} />
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <button
            style={btn}
            onClick={() => {
              const cats = init?.data?.categories || [];
              if (!selectedCat && cats[0]) {
                setSelectedCat(`${cats[0].group}:${cats[0].code}`);
              }
              setScreen('req_category');
            }}
          >
            ➕ Новая заявка
          </button>
          <button style={btn} onClick={openGarage}>🚗 Гараж</button>
          <button style={btn} onClick={openRequests}>🗂 Мои заявки</button>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary>init</summary>
          <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
        </details>
      </div>
    );
  }

  // ---- VENDOR ----
  return (
    <div style={wrap}>
      <Header role="vendor" onReset={resetRole} />
      {!subActive ? (
        <>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            Подписка не активна. Выберите тариф, чтобы открыть ленту заявок.
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <button style={btn}>7 дней — 300 ₽</button>
            <button style={btn}>30 дней — 600 ₽</button>
            <button style={btn}>60 дней — 1000 ₽</button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <button style={btn}>📰 Лента заявок</button>
          <button style={btn}>💬 Мои офферы</button>
          <button style={btn}>💳 Подписка</button>
        </div>
      )}
      <details style={{ marginTop: 12 }}>
        <summary>init</summary>
        <pre style={pre}>{JSON.stringify(init, null, 2)}</pre>
      </details>
    </div>
  );
}

// ---------- UI helpers ----------
function Header({ role, onReset }: { role: UIRole; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <h2 style={h2}>CarHelper — {role === 'user' ? 'Пользователь' : 'Вендор'}</h2>
      <button style={btnSmall} onClick={onReset}>Сменить роль</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 13, opacity: 0.8 }}>{label}</span>
      {children}
    </label>
  );
}

function nullIfEmpty(v: string) {
  return v.trim() === '' ? null : v.trim();
}

function fmtDate(v?: string) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return v; }
}
function statusLabel(s?: string) {
  switch ((s || '').toLowerCase()) {
    case 'open': return 'Открыта';
    case 'in_progress': return 'В работе';
    case 'done': return 'Завершена';
    case 'canceled': return 'Отменена';
    default: return s || '—';
  }
}
function carLabel(r: any) {
  const parts: string[] = [];
  if (r.make) parts.push(String(r.make).trim());
  if (r.model) parts.push(String(r.model).trim());
  const base = parts.join(' ');
  const year = r.year ? ` (${r.year})` : '';
  const vin  = r.vin ? ` · VIN: ${r.vin}` : '';
  return (base || 'Авто') + year + vin;
}

// ---------- styles ----------
const wrap: React.CSSProperties = {
  padding: 20,
  fontFamily: 'Inter, system-ui, sans-serif',
  backgroundColor: '#0d0d0d',
  color: '#fff',
  minHeight: '100vh',
};
const h2: React.CSSProperties = { margin: 0, color: '#fff' };
const btn: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #333',
  background: '#1a1a1a',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSmall: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #333',
  background: '#1a1a1a',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '14px',
};
const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: '1px solid #333',
  background: '#141414',
};
const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #333',
  background: '#0f0f0f',
  color: '#fff',
  outline: 'none',
};
const pre: React.CSSProperties = {
  background: '#111',
  color: '#ccc',
  padding: 10,
  borderRadius: 8,
  marginTop: 8,
  maxHeight: 260,
  overflow: 'auto',
};
const errorStyle: React.CSSProperties = { color: '#ff6b6b', marginTop: 12 };

function mapStep(s: SessionState) {
  switch (s) {
    case 'req_title': return 'Заголовок';
    case 'req_photo': return 'Фото';
    case 'req_desc': return 'Описание';
    case 'req_confirm': return 'Подтверждение';
    default: return s;
  }
}
