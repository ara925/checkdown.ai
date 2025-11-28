import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/useAuth";
import { 
  ArrowRight, Sparkles, Zap, Shield, Users, TrendingUp, ChevronDown,
  Home, LogOut, Brain, Rocket, Clock, CheckCircle2, Star, BarChart3,
  Globe, Lock, MessageSquare, Target, Cpu, Database, Workflow, Layers,
  Cog, ChartBar, Accessibility, BadgeCheck
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow rounded-full w-16 h-16 bg-primary"></div>
      </div>
    );
  }

  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: "AI-Powered Intelligence",
      description: "Advanced machine learning algorithms automatically extract, categorize, and prioritize tasks from any meeting or transcript",
      delay: "0s"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Real-Time Sync",
      description: "Instant synchronization across all platforms and devices with sub-second latency using edge computing",
      delay: "0.1s"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Military-Grade Security",
      description: "AES-256 encryption, row-level security policies, and SOC 2 Type II compliance for enterprise peace of mind",
      delay: "0.2s"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Intelligent Collaboration",
      description: "Smart team workflows with automatic task routing based on skills, availability, and workload distribution",
      delay: "0.3s"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Predictive Analytics",
      description: "ML-powered insights predict project completion times, identify bottlenecks, and optimize team performance",
      delay: "0.4s"
    },
    {
      icon: <Cpu className="w-8 h-8" />,
      title: "Neural Processing",
      description: "Context-aware task understanding that learns from your workflow patterns and improves over time",
      delay: "0.5s"
    },
  ];

  const deepFeatures = [
    {
      id: "automation",
      title: "Automation",
      headline: "Automate task capture from conversations",
      content: "Detect action items, owners, due dates, and dependencies in real time.",
      points: ["Entity extraction", "Smart owner detection", "Due date inference", "Dependency mapping"],
      icon: <Zap className="w-6 h-6" />
    },
    {
      id: "planning",
      title: "Planning",
      headline: "Plan with predictive insights",
      content: "Forecast timelines and surface risks with ML-powered estimates.",
      points: ["Monte Carlo projections", "Bottleneck detection", "Capacity heatmaps", "What-if scenarios"],
      icon: <ChartBar className="w-6 h-6" />
    },
    {
      id: "governance",
      title: "Governance",
      headline: "Operate securely at scale",
      content: "SOC2-ready controls with RLS, audit trails, and least-privilege roles.",
      points: ["Row-Level Security", "Audit logging", "Role-based access", "PII safeguards"],
      icon: <Shield className="w-6 h-6" />
    }
  ];

  const howItWorks = [
    { step: 1, title: "Connect", desc: "Link meetings, chat, and email with one click.", icon: <Globe className="w-6 h-6" /> },
    { step: 2, title: "Understand", desc: "AI parses context to identify tasks and owners.", icon: <Brain className="w-6 h-6" /> },
    { step: 3, title: "Organize", desc: "Group by projects, departments, and workflows.", icon: <Layers className="w-6 h-6" /> },
    { step: 4, title: "Execute", desc: "Track progress and update states in real time.", icon: <Workflow className="w-6 h-6" /> },
    { step: 5, title: "Improve", desc: "Analyze performance and optimize cycles.", icon: <TrendingUp className="w-6 h-6" /> }
  ];

  const faqs = [
    { q: "How is data secured?", a: "We enforce Row-Level Security, encrypt data in transit and at rest, and provide audit logs for privileged actions." },
    { q: "Does it support my tools?", a: "Yes. We integrate with major meeting, chat, and email platforms and expose APIs for custom workflows." },
    { q: "What’s the pricing model?", a: "Simple per-seat pricing with usage-based options for high-volume ML features." },
    { q: "Is it accessible?", a: "We target WCAG AA, include ARIA labels and roles, and support keyboard navigation across all interactive elements." }
  ];

  const caseStudies = [
    { org: "Acme Robotics", result: "3x faster delivery cycles", detail: "Reduced coordination overhead with meeting-to-task automation." },
    { org: "BrightSales", result: "+40% conversion", detail: "Immediate follow-ups from call summaries increased pipeline velocity." },
    { org: "NovaHealth", result: "Zero PII incidents", detail: "RLS + audit enabled strict access hygiene while scaling." }
  ];

  const stats = [
    { value: "99.9%", label: "Uptime SLA", icon: <Rocket className="w-6 h-6" /> },
    { value: "<100ms", label: "API Response", icon: <Zap className="w-6 h-6" /> },
    { value: "256-bit", label: "Encryption", icon: <Lock className="w-6 h-6" /> },
    { value: "24/7", label: "AI Processing", icon: <Brain className="w-6 h-6" /> },
  ];

  const integrations = [
    { name: "Google Meet", icon: <Globe className="w-6 h-6" /> },
    { name: "Microsoft Teams", icon: <MessageSquare className="w-6 h-6" /> },
    { name: "Zoom", icon: <Users className="w-6 h-6" /> },
    { name: "Slack", icon: <MessageSquare className="w-6 h-6" /> },
    { name: "Harvest", icon: <Clock className="w-6 h-6" /> },
    { name: "Gmail", icon: <Database className="w-6 h-6" /> },
  ];

  const useCases = [
    {
      title: "Engineering Teams",
      description: "Track sprint planning, code reviews, and technical debt from standup meetings",
      icon: <Cpu className="w-12 h-12" />,
      metrics: "85% faster task creation"
    },
    {
      title: "Sales Organizations",
      description: "Convert client calls into actionable follow-ups and pipeline tasks automatically",
      icon: <Target className="w-12 h-12" />,
      metrics: "40% increase in conversions"
    },
    {
      title: "Product Teams",
      description: "Transform roadmap discussions and user feedback into prioritized feature requests",
      icon: <Workflow className="w-12 h-12" />,
      metrics: "3x faster time-to-market"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float"
          style={{
            top: "10%",
            left: "5%",
            transform: `translateY(${scrollY * 0.1}px)`
          }}
        />
        <div 
          className="absolute w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float"
          style={{
            bottom: "10%",
            right: "5%",
            animationDelay: "2s",
            transform: `translateY(${-scrollY * 0.15}px)`
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-float"
          style={{
            top: "50%",
            right: "20%",
            animationDelay: "4s",
            transform: `translateY(${scrollY * 0.05}px)`
          }}
        />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.05)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.05)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        {/* Scanline effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,hsl(var(--primary)/0.02)_50%)] bg-[size:100%_4px] animate-pulse" />
        
        {/* Mouse follower glow */}
        <div 
          className="absolute w-96 h-96 bg-primary/10 rounded-full blur-3xl transition-all duration-300 ease-out"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-6 backdrop-blur-sm bg-background/50 border-b border-primary/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            Trackspot
          </Link>
          <div className="flex gap-3 items-center">
            {user ? (
              <>
                <Button asChild variant="ghost" className="text-foreground hover:text-primary">
                  <Link to="/dashboard">
                    <Home className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="border-primary/50 hover:bg-primary/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-foreground hover:text-primary">
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
                  <Link to="/sign-up">Get Started <ArrowRight className="ml-2 w-4 h-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block animate-slide-in-up opacity-0 mb-6" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
            <Badge className="glass-effect border-primary/30 px-4 py-2 text-base">
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              Next-Generation Task Intelligence
            </Badge>
          </div>
          
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold mb-6 animate-slide-in-up opacity-0 leading-tight" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
              AI That Thinks
            </span>
            <br />
            <span className="text-foreground">Like Your Team</span>
          </h1>
          
          <p className="text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-slide-in-up opacity-0 leading-relaxed" style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}>
            Transform meetings and conversations into actionable intelligence. 
            Our neural-powered platform automatically extracts, organizes, and optimizes your workflow—so your team can focus on what matters.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in-up opacity-0 mb-12" style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}>
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all animate-pulse-glow text-lg px-8 py-6">
              <Link to="/sign-up">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary/50 hover:bg-primary/10 text-lg px-8 py-6">
              <Link to="/sign-in">Watch Demo</Link>
            </Button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto animate-slide-in-up opacity-0" style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}>
            {stats.map((stat, index) => (
              <div key={index} className="glass-effect p-6 rounded-xl border border-primary/20">
                <div className="flex justify-center mb-2 text-primary">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-16 animate-bounce">
            <ChevronDown className="w-8 h-8 text-primary mx-auto" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 py-32" aria-label="How it works">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 glass-effect border-primary/30">
              <Workflow className="w-4 h-4 mr-2" />
              How It Works
            </Badge>
            <h2 className="text-5xl md:text-6xl font-bold">Simple, Powerful, Repeatable</h2>
            <p className="text-muted-foreground mt-4">From intake to insight in five streamlined steps.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-6">
            {howItWorks.map((s) => (
              <div key={s.step} className="glass-effect p-6 rounded-2xl border border-primary/20 hover:border-primary/50 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-primary">{s.icon}</div>
                  <span className="text-sm text-muted-foreground">Step {s.step}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-6 py-32 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Badge className="mb-4 glass-effect border-primary/30">
              <Cpu className="w-4 h-4 mr-2" />
              Advanced Capabilities
            </Badge>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Powered by AI
              </span>
              <br />
              <span className="text-foreground">Built for Scale</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Experience the next generation of task management with cutting-edge machine learning, 
              real-time collaboration, and enterprise-grade infrastructure.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-effect p-8 rounded-2xl hover:scale-105 transition-all duration-300 group cursor-pointer border border-primary/10 animate-slide-in-up opacity-0"
                style={{ animationDelay: feature.delay, animationFillMode: "forwards" }}
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 group-hover:animate-pulse-glow">
                  <div className="text-primary-foreground">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Deep feature tabs */}
          <div className="mt-24">
            <Tabs defaultValue="automation" className="max-w-5xl mx-auto">
              <TabsList aria-label="Feature categories" className="grid grid-cols-3">
                {deepFeatures.map(df => (
                  <TabsTrigger key={df.id} value={df.id} aria-label={df.title}>{df.title}</TabsTrigger>
                ))}
              </TabsList>
              {deepFeatures.map(df => (
                <TabsContent key={df.id} value={df.id} className="mt-8">
                  <div className="glass-effect rounded-2xl p-8 border border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-primary">{df.icon}</div>
                      <h3 className="text-2xl font-semibold">{df.headline}</h3>
                    </div>
                    <p className="text-muted-foreground mb-6">{df.content}</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {df.points.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <BadgeCheck className="w-4 h-4 text-primary" />
                          <span className="text-sm">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </section>

      {/* Security & Accessibility */}
      <section className="relative z-10 px-6 py-32 bg-gradient-to-b from-transparent via-primary/5 to-transparent" aria-label="Security and accessibility">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div className="glass-effect p-8 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-semibold">Security by Design</h3>
            </div>
            <p className="text-muted-foreground mb-4">Row-Level Security, least-privilege roles, encryption, and audit logging. Built to meet enterprise standards.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Row-Level Security", "Audit Trails", "Role-Based Access", "PII Guardrails",
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="w-4 h-4 text-primary" /> {p}
                </div>
              ))}
            </div>
          </div>
          <div className="glass-effect p-8 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <Accessibility className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-semibold">Accessibility (WCAG AA)</h3>
            </div>
            <p className="text-muted-foreground mb-4">Keyboard navigation, ARIA roles, color contrast, and focus management ensure inclusive experiences.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "ARIA labels and roles", "Semantic landmarks", "Visible focus states", "Keyboard operability",
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="w-4 h-4 text-primary" /> {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative z-10 px-6 py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Badge className="mb-4 glass-effect border-primary/30">
              <Target className="w-4 h-4 mr-2" />
              Real-World Impact
            </Badge>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-foreground">Built for</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Every Team
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => (
              <Card key={index} className="glass-effect border-primary/20 hover:border-primary/50 transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <div className="text-primary">
                      {useCase.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-foreground">{useCase.title}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">{useCase.description}</p>
                  <Badge className="bg-primary/10 text-primary border-0">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {useCase.metrics}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="relative z-10 px-6 py-32" aria-label="Case studies">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 glass-effect border-primary/30">
              <Target className="w-4 h-4 mr-2" />
              Proven Outcomes
            </Badge>
            <h2 className="text-5xl md:text-6xl font-bold">Results That Compound</h2>
            <p className="text-muted-foreground mt-4">Teams improve throughput, reliability, and security with measurable impact.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {caseStudies.map((c, i) => (
              <div key={i} className="glass-effect p-8 rounded-2xl border border-primary/20">
                <h3 className="text-xl font-semibold mb-2">{c.org}</h3>
                <Badge className="mb-3 bg-primary/10 text-primary border-0">{c.result}</Badge>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="relative z-10 px-6 py-32 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto text-center">
          <Badge className="mb-4 glass-effect border-primary/30">
            <Workflow className="w-4 h-4 mr-2" />
            Seamless Connections
          </Badge>
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Integrates With
            </span>
            <br />
            <span className="text-foreground">Your Entire Stack</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-16">
            Connect seamlessly with the tools your team already uses. Zero configuration, instant synchronization.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {integrations.map((integration, index) => (
              <div key={index} className="glass-effect p-6 rounded-xl border border-primary/20 hover:border-primary/50 transition-all hover:scale-105 cursor-pointer">
                <div className="text-primary mb-3 flex justify-center">
                  {integration.icon}
                </div>
                <div className="text-sm font-medium text-foreground">{integration.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 px-6 py-32 bg-gradient-to-b from-transparent via-primary/5 to-transparent" aria-label="Frequently asked questions">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 glass-effect border-primary/30">
              <MessageSquare className="w-4 h-4 mr-2" />
              FAQ
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold">Answers, upfront</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {faqs.map((f, i) => (
              <details key={i} className="glass-effect p-6 rounded-2xl border border-primary/20">
                <summary className="cursor-pointer text-lg font-semibold text-foreground">{f.q}</summary>
                <p className="mt-3 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="relative z-10 px-6 py-32">
        <div className="max-w-7xl mx-auto">
          <div className="glass-effect p-12 md:p-16 rounded-3xl border border-primary/20">
            <div className="grid md:grid-cols-3 gap-12 text-center">
              <div>
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                  10,000+
                </div>
                <div className="text-xl text-muted-foreground">Teams Worldwide</div>
              </div>
              <div>
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                  5M+
                </div>
                <div className="text-xl text-muted-foreground">Tasks Processed</div>
              </div>
              <div>
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                  98%
                </div>
                <div className="text-xl text-muted-foreground">Customer Satisfaction</div>
              </div>
            </div>

            <div className="mt-16 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-8 h-8 fill-primary text-primary" />
              ))}
            </div>
            <p className="text-center text-muted-foreground mt-4 text-lg">
              "Trackspot has completely transformed how we manage our workflow"
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-32">
        <div className="max-w-5xl mx-auto text-center">
          <div className="glass-effect p-16 rounded-3xl border border-primary/20">
            <Badge className="mb-6 glass-effect border-primary/30 text-base px-4 py-2">
              <Rocket className="w-4 h-4 mr-2" />
              Start Your Journey
            </Badge>
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Ready to build
              </span>
              <br />
              <span className="text-foreground">the future?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Join thousands of forward-thinking teams using AI to stay ahead. 
              Start free, scale effortlessly, transform completely.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all animate-pulse-glow text-lg px-12 py-7">
                <Link to="/sign-up">
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-primary/10 backdrop-blur-sm bg-background/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Trackspot
              </span>
            </div>
            <div className="text-muted-foreground text-center">
              <p>&copy; 2024 Trackspot AI. All rights reserved.</p>
              <p className="text-sm mt-2">Built with next-gen technology for next-gen teams</p>
            </div>
            <div className="flex gap-6">
              <Link to="/sign-in" className="text-muted-foreground hover:text-primary transition-colors">
                Sign In
              </Link>
              <Link to="/sign-up" className="text-muted-foreground hover:text-primary transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
