// 鲸鱼大作战 · 桌面小窗（Windows）
//
// 一个真正的置顶透明窗口：分层窗口（UpdateLayeredWindow）+ 逐像素 alpha，
// 鲸鱼浮在所有窗口上面，可以拖到任意位置，右键能直接喂食/打工。
//
// 编译：bin/build-pet.mjs 会用系统自带的 csc.exe 编译成 pet-window.exe
// 运行：pet-window.exe --base http://127.0.0.1:49236 --assets <插件目录>\assets
//
// 注意：.NET Framework 自带的 csc 只支持到 C# 5，所以这里不用字符串插值、?、=> 成员。
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace WhalePet
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        private static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string baseUrl = "http://127.0.0.1:49236";
            string assets = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets");
            string stateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "dsh-whale-battle");

            // 允许用同目录的 pet-config.json 配置（explorer 启动时传不了参数）
            try
            {
                string configFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pet-config.json");
                if (File.Exists(configFile))
                {
                    var serializer = new JavaScriptSerializer();
                    var config = serializer.Deserialize<PetConfig>(File.ReadAllText(configFile));
                    if (config != null)
                    {
                        if (!string.IsNullOrEmpty(config.baseUrl)) baseUrl = config.baseUrl;
                        if (!string.IsNullOrEmpty(config.assets)) assets = config.assets;
                        if (!string.IsNullOrEmpty(config.state)) stateDir = config.state;
                    }
                }
            }
            catch { }

            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--base") baseUrl = args[i + 1];
                else if (args[i] == "--assets") assets = args[i + 1];
                else if (args[i] == "--state") stateDir = args[i + 1];
            }

            // 没有显式指定时，读插件上次运行时记下的地址（DSH 的端口可能会变）
            if (baseUrl == "http://127.0.0.1:49236")
            {
                try
                {
                    string baseFile = Path.Combine(stateDir, "base-url.txt");
                    if (File.Exists(baseFile))
                    {
                        string saved = File.ReadAllText(baseFile).Trim();
                        if (!string.IsNullOrEmpty(saved)) baseUrl = saved;
                    }
                }
                catch { }
            }
            baseUrl = baseUrl.TrimEnd('/');

            try
            {
                Directory.CreateDirectory(stateDir);
            }
            catch { }

            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
            {
                CrashLog(stateDir, e.Exception);
            };

            bool created;
            using (var mutex = new Mutex(true, "dsh-whale-battle-pet-window", out created))
            {
                if (!created)
                {
                    // 已经有一条鲸鱼在桌面上了
                    return;
                }
                try
                {
                    Application.Run(new PetForm(baseUrl, assets, stateDir));
                }
                catch (Exception error)
                {
                    CrashLog(stateDir, error);
                }
                GC.KeepAlive(mutex);
            }
        }

        private static void CrashLog(string dir, Exception error)
        {
            try
            {
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "pet-crash.txt"), DateTime.Now.ToString("HH:mm:ss") + " " + error + Environment.NewLine);
            }
            catch { }
        }
    }

    internal sealed class PetForm : Form
    {
        private const int WS_EX_LAYERED = 0x80000;
        private const int WS_EX_TOOLWINDOW = 0x80;
        private const int WS_EX_TOPMOST = 0x8;
        private const int WM_NCHITTEST = 0x84;
        private const int HTTRANSPARENT = -1;
        private const int HTCLIENT = 1;

        private const int WindowWidth = 460;
        private const int WindowHeight = 420;

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }

        [StructLayout(LayoutKind.Sequential)]
        private struct SIZE { public int cx; public int cy; }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        private struct BLENDFUNCTION
        {
            public byte BlendOp;
            public byte BlendFlags;
            public byte SourceConstantAlpha;
            public byte AlphaFormat;
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetDC(IntPtr hWnd);
        [DllImport("user32.dll")]
        private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
        [DllImport("gdi32.dll")]
        private static extern IntPtr CreateCompatibleDC(IntPtr hdc);
        [DllImport("gdi32.dll")]
        private static extern bool DeleteDC(IntPtr hdc);
        [DllImport("gdi32.dll")]
        private static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
        [DllImport("gdi32.dll")]
        private static extern bool DeleteObject(IntPtr hObject);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst,
            ref SIZE psize, IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);

        private readonly string _baseUrl;
        private readonly string _assetsDir;
        private readonly string _stateDir;
        private readonly string _logFile;

        private Image _idle;
        private Image _blink;
        private Image _happy;
        private Icon _trayIcon;

        private Bitmap _hitBitmap;
        private readonly System.Windows.Forms.Timer _animTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer _pollTimer = new System.Windows.Forms.Timer();
        private readonly NotifyIcon _tray = new NotifyIcon();

        private double _phase;
        private DateTime _lastBlink = DateTime.MinValue;
        private DateTime _lastHappy = DateTime.MinValue;
        private bool _blinking;

        private string _bubble = "";
        private DateTime _bubbleUntil = DateTime.MinValue;
        private bool _expanded;
        private bool _dragging;
        private bool _moved;
        private Point _dragStart;
        private Point _formStart;

        private PetState _state = new PetState();
        private bool _polling;
        private int _failures;
        private bool _closed;
        private bool _busyAction;
        private string _snapshotPath;
        private bool _loggedLayered;

        private const string IdleLines = "今天的仗还没打呢|尾巴摇一摇，水花四溅|别一直盯着我，看看屏幕|要不要一起打一关？|深海里很安静，和你这里一样";
        private static readonly string[] Idle = IdleLines.Split('|');
        private readonly Random _random = new Random();

        public PetForm(string baseUrl, string assetsDir, string stateDir)
        {
            _baseUrl = baseUrl;
            _assetsDir = assetsDir;
            _stateDir = stateDir;
            _snapshotPath = Environment.GetEnvironmentVariable("WHALE_PET_SNAPSHOT");
            Directory.CreateDirectory(_stateDir);
            _logFile = Path.Combine(_stateDir, "pet.log");

            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(WindowWidth, WindowHeight);
            Text = "鲸鱼大作战";

            LoadAssets();
            RestorePosition();

            _animTimer.Interval = 100;
            _animTimer.Tick += delegate { _phase += 0.10; Render(); };
            _animTimer.Start();

            _pollTimer.Interval = 4000;
            _pollTimer.Tick += delegate { StartPoll(); };
            _pollTimer.Start();

            SetupTray();
            Log("start base=" + _baseUrl + " assets=" + _assetsDir);
            StartPoll();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST;
                return cp;
            }
        }

        private void LoadAssets()
        {
            _idle = LoadImage("whale-idle.png");
            _blink = LoadImage("whale-blink.png");
            _happy = LoadImage("whale-happy.png");
            try
            {
                _trayIcon = new Icon(Path.Combine(_assetsDir, "tray.ico"));
            }
            catch
            {
                _trayIcon = SystemIcons.Application;
            }
            if (_idle == null)
            {
                Log("ERROR: 找不到 assets/whale-idle.png（assets=" + _assetsDir + "）");
            }
        }

        private Image LoadImage(string name)
        {
            try
            {
                using (var stream = new FileStream(Path.Combine(_assetsDir, name), FileMode.Open, FileAccess.Read))
                {
                    return Image.FromStream(stream);
                }
            }
            catch (Exception error)
            {
                Log("ERROR load " + name + ": " + error.Message);
                return null;
            }
        }

        private void SetupTray()
        {
            _tray.Icon = _trayIcon;
            _tray.Text = "鲸鱼大作战";
            _tray.Visible = true;
            var menu = new ContextMenuStrip();
            menu.Items.Add("显示 / 隐藏", null, delegate { ToggleVisible(); });
            menu.Items.Add("退出桌面宠物", null, delegate { ClosePet(); });
            _tray.ContextMenuStrip = menu;
            _tray.DoubleClick += delegate { ToggleVisible(); };
        }

        private void ToggleVisible()
        {
            Visible = !Visible;
            if (Visible)
            {
                Show();
                TopMost = true;
            }
        }

        private void ClosePet()
        {
            _closed = true;
            Log("exit by user");
            _tray.Visible = false;
            _animTimer.Stop();
            _pollTimer.Stop();
            Close();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            _closed = true;
            _animTimer.Stop();
            _pollTimer.Stop();
            _tray.Visible = false;
            SavePosition();
            base.OnFormClosing(e);
        }

        /* ------------------------------------------------------------ 网络 */

        private void StartPoll()
        {
            if (_polling || _closed) return;
            _polling = true;
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    string json = HttpGet(_baseUrl + "/dsh-whale-battle/state");
                    var serializer = new JavaScriptSerializer();
                    PetState next = serializer.Deserialize<PetState>(json);
                    BeginInvoke((Action)delegate
                    {
                        ApplyState(next);
                        _failures = 0;
                        _polling = false;
                        Render();
                    });
                }
                catch (Exception error)
                {
                    BeginInvoke((Action)delegate
                    {
                        _polling = false;
                        _failures++;
                        if (_failures == 1) Log("poll failed: " + error.Message);
                        if (_failures == 3)
                        {
                            SetBubble("连不上 DSH 了，等一下再试…", 8);
                        }
                        if (_failures > 24)
                        {
                            Log("too many failures, exit");
                            ClosePet();
                        }
                        Render();
                    });
                }
            });
        }

        private static string HttpGet(string url)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = 4000;
            request.Method = "GET";
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private void PostAction(string action)
        {
            if (_busyAction || _closed) return;
            _busyAction = true;
            ThreadPool.QueueUserWorkItem(delegate
            {
                string hint = null;
                try
                {
                    string body = "{\"action\":\"" + action + "\"}";
                    var request = (HttpWebRequest)WebRequest.Create(_baseUrl + "/dsh-whale-battle/care");
                    request.Method = "POST";
                    request.ContentType = "application/json";
                    request.Timeout = 6000;
                    byte[] bytes = Encoding.UTF8.GetBytes(body);
                    request.ContentLength = bytes.Length;
                    using (var stream = request.GetRequestStream()) { stream.Write(bytes, 0, bytes.Length); }
                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                    {
                        string json = reader.ReadToEnd();
                        var serializer = new JavaScriptSerializer();
                        PetState next = serializer.Deserialize<PetState>(json);
                        if (next != null && next.log != null && next.log.Count > 0)
                        {
                            hint = next.log[next.log.Count - 1].text;
                        }
                    }
                }
                catch (WebException error)
                {
                    hint = ReadError(error);
                }
                catch (Exception error)
                {
                    hint = "操作失败：" + error.Message;
                }
                BeginInvoke((Action)delegate
                {
                    _busyAction = false;
                    if (!string.IsNullOrEmpty(hint)) SetBubble(hint, 7);
                    StartPoll();
                    Render();
                });
            });
        }

        private static string ReadError(WebException error)
        {
            try
            {
                if (error.Response == null) return "网络错误：" + error.Message;
                using (var reader = new StreamReader(error.Response.GetResponseStream(), Encoding.UTF8))
                {
                    string json = reader.ReadToEnd();
                    var serializer = new JavaScriptSerializer();
                    var payload = serializer.Deserialize<Dictionary<string, object>>(json);
                    object message;
                    if (payload != null && payload.TryGetValue("error", out message)) return Convert.ToString(message);
                }
            }
            catch { }
            return "操作失败";
        }

        private void ApplyState(PetState next)
        {
            if (next == null) return;
            _state = next;
            if (next.care != null && next.lead != null)
            {
                _state.happy = next.care.mood >= 70;
            }
            if (!string.IsNullOrEmpty(_snapshotPath))
            {
                try
                {
                    using (var bitmap = new Bitmap(WindowWidth, WindowHeight, PixelFormat.Format32bppArgb))
                    using (var g = Graphics.FromImage(bitmap))
                    {
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.TextRenderingHint = TextRenderingHint.AntiAlias;
                        g.Clear(Color.FromArgb(255, 240, 244, 250));
                        DrawScene(g);
                        bitmap.Save(_snapshotPath, ImageFormat.Png);
                    }
                    Log("snapshot saved " + _snapshotPath);
                }
                catch (Exception error)
                {
                    Log("snapshot failed: " + error.Message);
                }
                ClosePet();
            }
        }

        private void SetBubble(string text, int seconds)
        {
            _bubble = text;
            _bubbleUntil = DateTime.Now.AddSeconds(seconds);
            Render();
        }

        /* ------------------------------------------------------------ 绘制 */

        private void Render()
        {
            if (_closed || _idle == null) return;
            try
            {
                var bitmap = new Bitmap(WindowWidth, WindowHeight, PixelFormat.Format32bppPArgb);
                using (var g = Graphics.FromImage(bitmap))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.TextRenderingHint = TextRenderingHint.AntiAlias;
                    g.Clear(Color.Transparent);
                    DrawScene(g);
                }
                _hitBitmap = bitmap;
                ApplyLayeredBitmap(bitmap);
            }
            catch (Exception error)
            {
                Log("render failed: " + error.Message);
            }
        }

        private void DrawScene(Graphics g)
        {
            int bob = (int)Math.Round(Math.Sin(_phase) * 4.0);

            if (_expanded)
            {
                DrawStatusCard(g, 24, 12, WindowWidth - 48);
            }
            else
            {
                DrawBubble(g, 24, 12, WindowWidth - 48);
            }

            DrawNameplate(g, WindowWidth / 2, 150);

            Image frame = _idle;
            DateTime now = DateTime.Now;
            if ((now - _lastBlink).TotalSeconds > 3.2 + _random.NextDouble() * 2.5)
            {
                _blinking = true;
                _lastBlink = now;
            }
            if ((now - _lastBlink).TotalMilliseconds > 170) _blinking = false;

            // 心情好时偶尔眯眼笑一下，而不是一直眯着
            if ((now - _lastHappy).TotalSeconds > 9 + _random.NextDouble() * 6)
            {
                _lastHappy = now;
            }
            bool happy = _state.care != null && _state.care.mood >= 70 && (now - _lastHappy).TotalSeconds < 1.4;

            if (_blinking) frame = _blink != null ? _blink : _idle;
            else if (happy && _happy != null) frame = _happy;

            int drawWidth = 300;
            int drawHeight = (int)Math.Round(frame.Height * (drawWidth / (double)frame.Width));
            int x = (WindowWidth - drawWidth) / 2;
            int y = WindowHeight - drawHeight - 22 + bob;
            g.DrawImage(frame, new Rectangle(x, y, drawWidth, drawHeight));
        }

        private void DrawBubble(Graphics g, int x, int y, int width)
        {
            string text = CurrentBubble();
            if (string.IsNullOrEmpty(text)) return;
            using (var font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point))
            {
                var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                SizeF measured = g.MeasureString(text, font, width - 28);
                int bubbleWidth = Math.Min(width, (int)Math.Ceiling(measured.Width) + 30);
                int bubbleHeight = Math.Max(40, (int)Math.Ceiling(measured.Height) + 20);
                int left = x + (width - bubbleWidth) / 2;
                var rect = new Rectangle(left, y, bubbleWidth, bubbleHeight);
                DrawRoundRect(g, rect, 15, Color.FromArgb(252, 255, 255, 255), Color.FromArgb(210, 190, 220, 255));
                // 小尾巴
                var tail = new Point[]
                {
                    new Point(WindowWidth / 2 - 8, rect.Bottom - 1),
                    new Point(WindowWidth / 2 + 8, rect.Bottom - 1),
                    new Point(WindowWidth / 2 + 2, rect.Bottom + 9)
                };
                using (var brush = new SolidBrush(Color.FromArgb(252, 255, 255, 255)))
                {
                    g.FillPolygon(brush, tail);
                }
                using (var brush = new SolidBrush(Color.FromArgb(28, 46, 78)))
                {
                    g.DrawString(text, font, brush, new RectangleF(rect.X + 14, rect.Y + 10, rect.Width - 28, rect.Height - 20), format);
                }
            }
        }

        private void DrawStatusCard(Graphics g, int x, int y, int width)
        {
            int height = 130;
            DrawRoundRect(g, new Rectangle(x, y, width, height), 16, Color.FromArgb(245, 252, 254, 255), Color.FromArgb(200, 190, 220, 255));
            using (var titleFont = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold, GraphicsUnit.Point))
            using (var smallFont = new Font("Microsoft YaHei UI", 8.5f, FontStyle.Regular, GraphicsUnit.Point))
            using (var dark = new SolidBrush(Color.FromArgb(28, 46, 78)))
            using (var dim = new SolidBrush(Color.FromArgb(96, 116, 146)))
            {
                g.DrawString("小鲸鱼 · Lv." + _state.leadLevel(), titleFont, dark, x + 16, y + 12);
                g.DrawString("金币 " + _state.gold, smallFont, dim, x + width - 96, y + 15);

                string[] labels = { "饱食", "清洁", "心情", "体力" };
                double[] values = {
                    _state.care == null ? 0 : _state.care.hunger,
                    _state.care == null ? 0 : _state.care.clean,
                    _state.care == null ? 0 : _state.care.mood,
                    _state.care == null ? 0 : _state.care.stamina
                };
                for (int i = 0; i < 4; i++)
                {
                    int rowY = y + 44 + i * 20;
                    g.DrawString(labels[i], smallFont, dim, x + 16, rowY);
                    var track = new Rectangle(x + 58, rowY + 4, width - 92, 9);
                    using (var trackBrush = new SolidBrush(Color.FromArgb(226, 233, 245)))
                    {
                        g.FillRectangle(trackBrush, track);
                    }
                    int fill = (int)Math.Round((track.Width) * Math.Max(0, Math.Min(100, values[i])) / 100.0);
                    Color color = values[i] > 60 ? Color.FromArgb(76, 195, 138) : values[i] > 30 ? Color.FromArgb(242, 181, 68) : Color.FromArgb(239, 107, 107);
                    using (var fillBrush = new SolidBrush(color))
                    {
                        g.FillRectangle(fillBrush, new Rectangle(track.X, track.Y, Math.Max(3, fill), track.Height));
                    }
                    g.DrawString(((int)values[i]).ToString(CultureInfo.InvariantCulture), smallFont, dark, x + width - 34, rowY);
                }
            }
        }

        private void DrawNameplate(Graphics g, int centerX, int y)
        {
            string text = _state.leadName() + "  Lv." + _state.leadLevel() + "    ◆ 金币 " + _state.gold;
            using (var font = new Font("Microsoft YaHei UI", 9f, FontStyle.Regular, GraphicsUnit.Point))
            {
                SizeF size = g.MeasureString(text, font);
                int width = (int)size.Width + 30;
                var rect = new Rectangle(centerX - width / 2, y, width, 28);
                DrawRoundRect(g, rect, 14, Color.FromArgb(210, 18, 30, 52), Color.FromArgb(120, 140, 180, 255));
                using (var brush = new SolidBrush(Color.FromArgb(226, 236, 252)))
                {
                    var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    g.DrawString(text, font, brush, rect, format);
                }
            }
        }

        private static void DrawRoundRect(Graphics g, Rectangle rect, int radius, Color fill, Color border)
        {
            using (var path = new GraphicsPath())
            {
                int d = radius * 2;
                path.AddArc(rect.X, rect.Y, d, d, 180, 90);
                path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
                path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
                path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
                path.CloseFigure();
                using (var brush = new SolidBrush(fill)) g.FillPath(brush, path);
                using (var pen = new Pen(border, 1f)) g.DrawPath(pen, path);
            }
        }

        private string CurrentBubble()
        {
            if (DateTime.Now < _bubbleUntil && !string.IsNullOrEmpty(_bubble)) return _bubble;
            if (_state == null || _state.care == null) return "小鲸鱼正在游过来…";
            if (_state.care.hunger < 22) return "饿得游不动了…";
            if (_state.care.mood < 25) return "陪陪我嘛，就一会儿。";
            if (_state.care.clean < 22) return "身上有点味道，想洗澡。";
            if (_state.care.stamina < 18) return "眼皮在打架，让我睡会儿。";
            return Idle[Math.Abs(Environment.TickCount / 12000) % Idle.Length];
        }

        /* ------------------------------------------------------------ 窗口 */

        private void ApplyLayeredBitmap(Bitmap bitmap)
        {
            IntPtr screenDc = GetDC(IntPtr.Zero);
            IntPtr memDc = CreateCompatibleDC(screenDc);
            IntPtr hBitmap = IntPtr.Zero;
            IntPtr oldBitmap = IntPtr.Zero;
            try
            {
                hBitmap = bitmap.GetHbitmap(Color.FromArgb(0));
                oldBitmap = SelectObject(memDc, hBitmap);
                var size = new SIZE { cx = bitmap.Width, cy = bitmap.Height };
                var src = new POINT { X = 0, Y = 0 };
                var dst = new POINT { X = Left, Y = Top };
                var blend = new BLENDFUNCTION
                {
                    BlendOp = 0,
                    BlendFlags = 0,
                    SourceConstantAlpha = 255,
                    AlphaFormat = 1
                };
                bool ok = UpdateLayeredWindow(Handle, screenDc, ref dst, ref size, memDc, ref src, 0, ref blend, 2);
                if (!ok)
                {
                    Log("UpdateLayeredWindow failed: " + Marshal.GetLastWin32Error());
                }
                else if (!_loggedLayered)
                {
                    _loggedLayered = true;
                    Log("layered window ready at " + dst.X + "," + dst.Y + " size " + size.cx + "x" + size.cy);
                }
            }
            finally
            {
                if (oldBitmap != IntPtr.Zero) SelectObject(memDc, oldBitmap);
                if (hBitmap != IntPtr.Zero) DeleteObject(hBitmap);
                DeleteDC(memDc);
                ReleaseDC(IntPtr.Zero, screenDc);
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST && _hitBitmap != null)
            {
                int screenX = unchecked((short)(long)m.LParam);
                int screenY = unchecked((short)((long)m.LParam >> 16));
                Point client = PointToClient(new Point(screenX, screenY));
                if (client.X < 0 || client.Y < 0 || client.X >= _hitBitmap.Width || client.Y >= _hitBitmap.Height)
                {
                    m.Result = (IntPtr)HTTRANSPARENT;
                    return;
                }
                try
                {
                    if (_hitBitmap.GetPixel(client.X, client.Y).A < 12)
                    {
                        m.Result = (IntPtr)HTTRANSPARENT;
                        return;
                    }
                }
                catch { }
                m.Result = (IntPtr)HTCLIENT;
                return;
            }
            base.WndProc(ref m);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Left)
            {
                _dragging = true;
                _moved = false;
                _dragStart = Cursor.Position;
                _formStart = Location;
            }
            else if (e.Button == MouseButtons.Right)
            {
                ShowMenu();
            }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (!_dragging) return;
            Point now = Cursor.Position;
            int dx = now.X - _dragStart.X;
            int dy = now.Y - _dragStart.Y;
            if (Math.Abs(dx) + Math.Abs(dy) > 4) _moved = true;
            Location = new Point(_formStart.X + dx, _formStart.Y + dy);
            Render();
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (!_dragging) return;
            _dragging = false;
            SavePosition();
            if (!_moved && e.Button == MouseButtons.Left)
            {
                _expanded = !_expanded;
                if (_expanded) StartPoll();
                Render();
            }
        }

        private void ShowMenu()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("喂食（8 金币）", null, delegate { PostAction("feed"); });
            menu.Items.Add("洗澡（6 金币）", null, delegate { PostAction("bath"); });
            menu.Items.Add("陪玩", null, delegate { PostAction("play"); });
            menu.Items.Add("训练", null, delegate { PostAction("train"); });
            menu.Items.Add("睡觉", null, delegate { PostAction("sleep"); });
            menu.Items.Add("打工（赚金币）", null, delegate { PostAction("work"); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("隐藏 30 分钟", null, delegate { HideFor(TimeSpan.FromMinutes(30)); });
            menu.Items.Add("退出", null, delegate { ClosePet(); });
            menu.Show(this, PointToClient(Cursor.Position));
        }

        private readonly System.Windows.Forms.Timer _hideTimer = new System.Windows.Forms.Timer();

        private void HideFor(TimeSpan span)
        {
            Visible = false;
            _hideTimer.Interval = (int)Math.Min(int.MaxValue, span.TotalMilliseconds);
            _hideTimer.Tick += delegate
            {
                _hideTimer.Stop();
                Visible = true;
                TopMost = true;
                Render();
            };
            _hideTimer.Start();
        }

        /* ------------------------------------------------------------ 位置 */

        private string PositionFile
        {
            get { return Path.Combine(_stateDir, "pet-pos.txt"); }
        }

        private void RestorePosition()
        {
            try
            {
                string text = File.ReadAllText(PositionFile);
                string[] parts = text.Split(',');
                if (parts.Length == 2)
                {
                    int x, y;
                    if (int.TryParse(parts[0], out x) && int.TryParse(parts[1], out y))
                    {
                        Rectangle screen = Screen.PrimaryScreen.WorkingArea;
                        if (x > -100 && y > -100 && x < screen.Right && y < screen.Bottom)
                        {
                            Location = new Point(x, y);
                            return;
                        }
                    }
                }
            }
            catch { }
            Rectangle area = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(area.Right - WindowWidth - 24, area.Bottom - WindowHeight - 8);
        }

        private void SavePosition()
        {
            try
            {
                File.WriteAllText(PositionFile, Location.X + "," + Location.Y);
            }
            catch { }
        }

        private void Log(string message)
        {
            try
            {
                File.AppendAllText(_logFile, DateTime.Now.ToString("HH:mm:ss") + " " + message + Environment.NewLine);
            }
            catch { }
        }
    }

    /* ---------------------------------------------------------------- 数据 */

    public sealed class PetConfig
    {
        public string baseUrl { get; set; }
        public string assets { get; set; }
        public string state { get; set; }
    }

    public sealed class PetCare
    {
        public double hunger { get; set; }
        public double clean { get; set; }
        public double mood { get; set; }
        public double stamina { get; set; }
    }

    public sealed class PetLead
    {
        public string name { get; set; }
        public int level { get; set; }
        public int exp { get; set; }
        public int expToNext { get; set; }
    }

    public sealed class PetLog
    {
        public string text { get; set; }
        public string kind { get; set; }
    }

    public sealed class PetState
    {
        public bool ok { get; set; }
        public int gold { get; set; }
        public PetCare care { get; set; }
        public PetLead lead { get; set; }
        public List<PetLog> log { get; set; }
        public bool happy { get; set; }

        public int leadLevel()
        {
            return lead == null ? 1 : lead.level;
        }

        public string leadName()
        {
            return lead == null || string.IsNullOrEmpty(lead.name) ? "小鲸鱼" : lead.name;
        }
    }
}
