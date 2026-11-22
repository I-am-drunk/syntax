"""
Lesson 1 · Page 3 — Perpendicular line through P(6, 1)
Gold-standard vertical slice built on `manim_syntax` + integrated Moving Sema.
Zero PowerPoint banners, zero side-cards, 100% Brilliant kinetic pedagogy.
"""

from __future__ import annotations

from manim import (
    DOWN,
    DR,
    LEFT,
    ORIGIN,
    RIGHT,
    UL,
    UP,
    UR,
    Create,
    FadeIn,
    FadeOut,
    FadeTransform,
    Indicate,
    Line,
    VGroup,
    rate_functions,
)
import numpy as np

from manim_syntax import (
    SemaPrompt,
    SyntaxGraph,
    SyntaxScene,
    make_math_chip,
    make_pill_badge,
    make_result_pill,
    make_token,
    make_whisper,
    orbital_swap_anims,
    parabolic_jump_anim,
    spin_sign_anim,
)


class L1P3_Vis1(SyntaxScene):
    """Beat 1 (Visual): Plot y = −3x − 3 and see slope m = −3."""

    def construct(self) -> None:
        th = self.theme
        graph = SyntaxGraph(th, x_range=(-6, 9), y_range=(-4.5, 4.5), x_ticks=(-3, 3, 6), y_ticks=(-3, 3))
        self.add(graph.root)
        self.verify.assert_isotropic(graph, "vis1")

        line_main = graph.line(-3, -3, color="blue", stroke_width=5.2)
        p_xint = graph.point(-1, 0, color="blue", radius=0.105)
        p_yint = graph.point(0, -3, color="blue", radius=0.105)
        p_target = graph.point(6, 1, label="P(6, 1)", direction=UP, color="amber", radius=0.115)

        tri = graph.rise_run(
            (-1, 0),
            (0, -3),
            run_label="run +1",
            rise_label="rise −3",
            run_color="amber",
            rise_color="red",
            shade_color="blue",
            run_dir=UP,
            rise_dir=RIGHT,
        )
        slope_badge = self.verify.register_label("slope_badge", make_pill_badge("m = −3", th, accent="blue", font_size=32).move_to(
            graph.pt(-3.1, -3.1)
        ))
        self.verify.assert_line_slope(graph, line_main, -3.0, name="vis1_main")
        self.verify.assert_point_on_line(graph, line_main, (-1, 0), name="vis1_main")
        self.verify.assert_point_on_line(graph, line_main, (0, -3), name="vis1_main")

        self.sema.enter(
            graph.pt(-3.3, 3.1),
            look_at=graph.pt(-1, 0),
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Plot the line",
                say="Start by graphing our given line y = −3x − 3.",
                subtitle="Plot y = −3x − 3 on the coordinate grid.",
                accent="blue",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "First, <cue:plot>plot the given line y equals negative three x minus three</cue>. "
            "Notice how <cue:run>every step of one unit right</cue> "
            "<cue:rise>drops the line three units down</cue>. "
            "That steep downhill triangle gives us <cue:slope>slope m equals negative three</cue>."
        ) as cue:
            self.play_until(
                cue["plot"].end,
                Create(line_main, rate_func=rate_functions.ease_out_cubic),
                FadeIn(p_xint, scale=0.6),
                FadeIn(p_yint, scale=0.6),
                FadeIn(p_target, scale=0.8),
            )

            self.sema.fly_to(
                graph.pt(2.6, 1.4),
                look_at=tri.corner_pt,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Right 1, down 3",
                    say="Step +1 right along x, then drop 3 units down.",
                    subtitle="Every +1 step right drops the line 3 units down.",
                    accent="amber",
                ),
            )
            self.play_until(
                cue["run"].end,
                Create(tri.run_line),
                FadeIn(tri.run_label, shift=UP * 0.12),
            )

            self.play_until(
                cue["rise"].end,
                Create(tri.rise_line),
                FadeIn(tri.shade),
                FadeIn(tri.rise_label, shift=RIGHT * 0.12),
            )

            self.sema.fly_to(
                graph.pt(-3.1, -0.7),
                look_at=slope_badge,
                state="nodding",
                expression="proud",
                prompt=SemaPrompt(
                    callout="m = −3",
                    say="Rise −3 over run +1 gives slope m = −3!",
                    subtitle="That steep downhill triangle is slope m = −3.",
                    accent="blue",
                ),
            )
            self.play_until(
                cue["slope"].end,
                FadeIn(slope_badge, scale=0.86, shift=UP * 0.14),
            )


class L1P3_Vis2(SyntaxScene):
    """Beat 2 (Visual): Rotate +90° with live sweeping sector to get m⊥ = +1/3."""

    def construct(self) -> None:
        th = self.theme
        graph = SyntaxGraph(th, x_range=(-6, 9), y_range=(-4.5, 4.5), x_ticks=(-3, 3, 6), y_ticks=(-3, 3))
        self.add(graph.root)
        self.verify.assert_isotropic(graph, "vis2")

        orig_dim = graph.line(-3, -3, color="blue", stroke_width=4.0, opacity=0.28)
        p_target = graph.point(6, 1, label="P(6, 1)", direction=UL, color="amber", radius=0.115)
        pivot_dot = graph.point(-0.6, -1.2, color="green", radius=0.115)

        rig = graph.make_rotation_rig(
            (-0.6, -1.2),
            base_slope=-3.0,
            line_color="teal",
            sector_color="green",
            badge_xy=(4.4, 3.1),
            final_label="m⊥ = +1/3",
        )
        elbow = graph.right_angle((-0.6, -1.2), (1, -3), (3, 1), size=0.36, color="green")
        tri = graph.rise_run(
            (0, -1),
            (3, 0),
            run_label="run +3",
            rise_label="rise +1",
            run_color="amber",
            rise_color="green",
            shade_color="teal",
            run_dir=DOWN,
            rise_dir=RIGHT,
        )

        self.add(orig_dim, p_target, rig.sector, rig.rotating_line, pivot_dot, rig.badge)

        self.sema.enter(
            graph.pt(-3.4, 2.9),
            look_at=rig.pivot_pt,
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Rotate +90°",
                say="Turn the line's direction a full 90 degrees!",
                subtitle="Rotate the direction a full 90° for a perpendicular line.",
                accent="teal",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "To build a perpendicular line, <cue:rot>rotate the direction a full ninety degrees</cue> "
            "to lock in a <cue:elbow>crisp right angle</cue>. "
            "A steep drop of three over one <cue:tri>turns into a gentle climb of one up for every three right</cue>, "
            "so the perpendicular slope is <cue:ans>positive one third</cue>."
        ) as cue:
            self.sema.track(
                rig.tip_point,
                offset=UL * 1.35 + LEFT * 0.4,
                look_at=rig.pivot_pt,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Rotating 90°",
                    say="Watch the green angle sweep all the way to 90°.",
                    subtitle="Rotate the direction a full 90°.",
                    accent="teal",
                ),
            )
            self.play_until(
                cue["rot"].end,
                rig.angle_deg.animate.set_value(90.0),
                rate_func=rate_functions.ease_in_out_cubic,
            )
            self.sema.untrack()

            self.sema.fly_to(
                graph.pt(-2.8, -2.9),
                look_at=rig.pivot_pt,
                state="guiding",
                expression="happy",
                prompt=SemaPrompt(
                    callout="90° right angle",
                    say="Exact 90° corner between the two lines!",
                    subtitle="The two lines now meet at a crisp 90° right angle.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["elbow"].end,
                Create(elbow),
            )

            self.sema.fly_to(
                graph.pt(5.3, -2.4),
                look_at=tri.corner_pt,
                state="nodding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Right 3, up 1",
                    say="Now every 3 steps right climbs gently 1 unit up.",
                    subtitle="Steep −3/1 flips into a gentle climb of +1/3.",
                    accent="amber",
                ),
            )
            self.play_until(
                cue["tri"].end,
                FadeIn(tri.shade),
                Create(tri.run_line),
                FadeIn(tri.run_label, shift=DOWN * 0.1),
                Create(tri.rise_line),
                FadeIn(tri.rise_label, shift=RIGHT * 0.1),
            )

            self.sema.fly_to(
                graph.pt(1.6, 3.0),
                look_at=rig.badge,
                state="nodding",
                expression="proud",
                prompt=SemaPrompt(
                    callout="m⊥ = +1/3",
                    say="Perpendicular slope locked: m⊥ = +1/3!",
                    subtitle="The perpendicular slope is positive one third.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["ans"].end,
                Indicate(rig.badge, color=th.green, scale_factor=1.08),
            )
            self.verify.assert_perpendicular(orig_dim, rig.rotating_line, name="vis2_90deg")
            self.verify.assert_line_slope(graph, rig.rotating_line, 1.0 / 3.0, name="vis2_perp")
            self.verify.assert_point_on_line(graph, rig.rotating_line, (-0.6, -1.2), name="vis2_perp")
            self.verify.assert_point_on_line(graph, rig.rotating_line, (0, -1), name="vis2_perp")
            self.verify.assert_point_on_line(graph, rig.rotating_line, (3, 0), name="vis2_perp")
            self.verify.assert_point_on_line(graph, rig.rotating_line, (6, 1), name="vis2_perp")


class L1P3_Vis3(SyntaxScene):
    """Beat 3 (Visual): Glide vertically like an elevator until locking onto P(6, 1)."""

    def construct(self) -> None:
        th = self.theme
        graph = SyntaxGraph(th, x_range=(-6, 9), y_range=(-4.5, 4.5), x_ticks=(-3, 3, 6), y_ticks=(-3, 3))
        self.add(graph.root)
        self.verify.assert_isotropic(graph, "vis3")

        orig_dim = graph.line(-3, -3, color="blue", stroke_width=3.8, opacity=0.25)
        p_target = graph.point(6, 1, label="P(6, 1)", direction=UP, color="amber", radius=0.125)
        rig = graph.make_elevator_rig(1.0 / 3.0, b_start=2.4, b_target=-1.0)
        elbow = graph.right_angle((-0.6, -1.2), (1, -3), (3, 1), size=0.32, color="green")
        eq_badge = make_pill_badge("y = 1/3 x − 1", th, accent="green", font_size=32).move_to(
            graph.pt(3.5, -3.2)
        )

        self.add(orig_dim, rig.rail, rig.gliding_line, rig.y_bead, rig.b_label, p_target)

        self.sema.enter(
            graph.pt(-3.3, 2.8),
            look_at=rig.bead_point,
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Slide to P(6, 1)",
                say="Keep the slope locked at 1/3 and glide down like an elevator.",
                subtitle="Slide the line vertically while keeping slope m⊥ = 1/3.",
                accent="teal",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "Now keep that slope locked at one third, and <cue:slide>slide the line vertically like an elevator</cue> "
            "until it <cue:lock>locks right onto point P at six, one</cue>. "
            "Right when it locks, it <cue:yint>crosses the y axis at negative one</cue> — "
            "giving <cue:eq>y equals one third x minus one</cue>."
        ) as cue:
            self.sema.track(
                rig.bead_point,
                offset=RIGHT * 2.15 + UP * 0.72,
                look_at=rig.bead_point,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Sliding b down...",
                    say="Watch the y-intercept bead glide smoothly down the y-axis.",
                    subtitle="Slide vertically until the line reaches P(6, 1).",
                    accent="teal",
                ),
            )
            self.play_until(
                cue["slide"].end,
                rig.b_tracker.animate.set_value(-1.0),
                rate_func=rate_functions.ease_in_out_cubic,
            )
            self.sema.untrack()

            ripples = graph.make_lock_ripple_anims((6, 1), color="green", max_radius=0.95)
            self.sema.fly_to(
                graph.pt(4.5, 3.0),
                look_at=graph.pt(6, 1),
                state="celebrate",
                expression="proud",
                prompt=SemaPrompt(
                    callout="Locked on P(6, 1)!",
                    say="Direct hit on P(6, 1)!",
                    subtitle="The perpendicular line locks right onto P(6, 1).",
                    accent="green",
                ),
            )
            self.play_until(
                cue["lock"].end,
                rig.lock_tracker.animate.set_value(1.0),
                *ripples,
                Create(elbow),
            )

            self.sema.fly_to(
                graph.pt(-2.5, -2.6),
                look_at=graph.pt(0, -1),
                state="nodding",
                expression="happy",
                prompt=SemaPrompt(
                    callout="b = −1!",
                    say="Look at the y-axis: it crosses right at (0, −1).",
                    subtitle="It crosses the y-axis at b = −1.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["yint"].end,
                Indicate(rig.y_bead, color=th.green, scale_factor=1.35),
            )

            self.sema.fly_to(
                graph.pt(6.2, -3.1),
                look_at=eq_badge,
                state="celebrate",
                expression="proud",
                prompt=SemaPrompt(
                    callout="y = 1/3 x − 1",
                    say="Final perpendicular equation: y = 1/3 x − 1!",
                    subtitle="Our perpendicular line is y = 1/3 x − 1.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["eq"].end,
                FadeIn(eq_badge, scale=0.86, shift=UP * 0.14),
            )
            self.verify.register_label("eq_badge", eq_badge)
            self.verify.assert_perpendicular(orig_dim, rig.gliding_line, name="vis3_90deg")
            self.verify.assert_line_slope(graph, rig.gliding_line, 1.0 / 3.0, name="vis3_locked")
            self.verify.assert_point_on_line(graph, rig.gliding_line, (6, 1), name="vis3_locked")
            self.verify.assert_point_on_line(graph, rig.gliding_line, (0, -1), name="vis3_locked")


class L1P3_Alg1(SyntaxScene):
    """Beat 1 (Algebra): Parabolic arc of +3x over '=' morphing mid-air into −3x."""

    def construct(self) -> None:
        th = self.theme

        whisper = make_whisper("Start in standard form", th)
        whisper_sub = make_whisper("Subtract 3x from both sides", th)
        whisper_read = make_whisper("Read slope m right in front of x", th)

        # Initial standard form:  3x   +   y   =   −3
        tok_3x = make_token("3x", th, color="blue", font_size=76).move_to(np.array([-3.05, 0.15, 0.0]))
        tok_plus = make_token("+", th, color="muted", font_size=68).move_to(np.array([-1.65, 0.15, 0.0]))
        tok_y = make_token("y", th, color="ink", font_size=76).move_to(np.array([-0.52, 0.15, 0.0]))
        tok_eq = make_token("=", th, color="muted", font_size=72).move_to(np.array([0.72, 0.15, 0.0]))
        tok_c = make_token("−3", th, color="ink", font_size=76).move_to(np.array([2.15, 0.15, 0.0]))

        # Final slope-intercept positions:  y   =   −3x   −3
        y_end = np.array([-2.65, 0.15, 0.0])
        eq_end = np.array([-1.35, 0.15, 0.0])
        neg3x_end = np.array([0.65, 0.15, 0.0])
        c_end = np.array([2.85, 0.15, 0.0])
        tok_neg3x_tpl = make_token("−3x", th, color="teal", font_size=76)

        res_pill = make_result_pill("Slope  m = −3", th, accent="blue", font_size=36).shift(DOWN * 2.15)

        self.sema.enter(
            np.array([-4.95, 1.85, 0.0]),
            look_at=tok_3x,
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Spot +3x",
                say="Start with 3x + y = −3. We want y by itself!",
                subtitle="Start with 3x + y = −3 and isolate y.",
                accent="blue",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "Start with <cue:intro>three x plus y equals negative three</cue>. "
            "To read the slope, <cue:jump>subtract three x from both sides so positive three x arcs across the equals sign as negative three x</cue>. "
            "That leaves y equals negative three x minus three, so <cue:slope>the slope is m equals negative three</cue>."
        ) as cue:
            self.play_until(
                cue["intro"].end,
                FadeIn(whisper, shift=DOWN * 0.1),
                FadeIn(VGroup(tok_3x, tok_plus, tok_y, tok_eq, tok_c), shift=UP * 0.15),
            )

            self.sema.track(
                tok_3x,
                offset=UP * 1.45 + RIGHT * 0.2,
                look_at=tok_3x,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Flip sign across =",
                    say="Move +3x across = and it flips to −3x!",
                    subtitle="Subtract 3x from both sides: +3x becomes −3x.",
                    accent="teal",
                ),
            )
            self.play_until(
                cue["jump"].end,
                FadeTransform(whisper, whisper_sub),
                parabolic_jump_anim(
                    tok_3x,
                    start_pos=tok_3x.get_center(),
                    end_pos=neg3x_end,
                    after_template=tok_neg3x_tpl,
                    lift=1.9,
                ),
                FadeOut(tok_plus, shift=DOWN * 0.25),
                tok_y.animate.move_to(y_end),
                tok_eq.animate.move_to(eq_end),
                tok_c.animate.move_to(c_end),
            )
            self.sema.untrack()

            self.sema.fly_to(
                np.array([4.35, -2.0, 0.0]),
                look_at=res_pill,
                state="nodding",
                expression="proud",
                prompt=SemaPrompt(
                    callout="m = −3",
                    say="The number right in front of x is our slope: m = −3!",
                    subtitle="Read the slope directly: m = −3.",
                    accent="blue",
                ),
            )
            self.play_until(
                cue["slope"].end,
                FadeTransform(whisper_sub, whisper_read),
                Indicate(tok_3x, color=th.teal, scale_factor=1.12),
                FadeIn(res_pill, shift=UP * 0.22, scale=0.92),
            )


class L1P3_Alg2(SyntaxScene):
    """Beat 2 (Algebra): Reveal −3/1, orbit 3 & 1 180° around bar, spin − into +."""

    def construct(self) -> None:
        th = self.theme

        whisper_1 = make_whisper("Write −3 as a fraction over 1", th)
        whisper_2 = make_whisper("Flip numerator and denominator 180°", th)
        whisper_3 = make_whisper("Switch the sign from negative to positive", th)

        bar_center = np.array([1.25, 0.15, 0.0])
        sign_anchor = np.array([-0.55, 0.15, 0.0])

        tok_m = make_token("m =", th, color="ink", font_size=72).move_to(np.array([-2.65, 0.15, 0.0]))
        tok_mperp = make_token("m⊥ =", th, color="ink", font_size=72).move_to(np.array([-2.65, 0.15, 0.0]))
        tok_sign = make_token("−", th, color="amber", font_size=80).move_to(sign_anchor)
        tok_plus_tpl = make_token("+", th, color="green", font_size=80)

        tok_3 = make_token("3", th, color="blue", font_size=74).move_to(bar_center)
        tok_1 = make_token("1", th, color="teal", font_size=74).move_to(bar_center + DOWN * 0.78)
        frac_bar = Line(
            bar_center + LEFT * 0.72,
            bar_center + RIGHT * 0.72,
            color=th.ink,
            stroke_width=5.0,
        )

        res_pill = make_result_pill("m⊥ = +1/3", th, accent="green", font_size=38).shift(DOWN * 2.25)

        self.sema.enter(
            np.array([-4.85, 1.45, 0.0]),
            look_at=tok_3,
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Write over 1",
                say="Any whole number is secretly a fraction over 1!",
                subtitle="Rewrite −3 as the fraction −3/1.",
                accent="blue",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "First, <cue:frac>write negative three as a fraction: negative three over one</cue>. "
            "To make it perpendicular, <cue:flip>flip the fraction upside down to one third</cue>, "
            "then <cue:sign>switch the negative sign to positive</cue> — "
            "giving <cue:done>m perpendicular equals positive one third</cue>."
        ) as cue:
            self.add(whisper_1, tok_m, tok_sign, tok_3)
            self.play_until(
                cue["frac"].end,
                tok_3.animate.move_to(bar_center + UP * 0.74),
                Create(frac_bar),
                FadeIn(tok_1, shift=DOWN * 0.18),
            )

            self.sema.fly_to(
                np.array([4.35, 1.55, 0.0]),
                look_at=bar_center,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="Flip 180°!",
                    say="Watch 3 and 1 orbit 180° around the fraction bar!",
                    subtitle="Flip numerator and denominator 180°: 3/1 becomes 1/3.",
                    accent="teal",
                ),
            )
            orb_3, orb_1 = orbital_swap_anims(tok_3, tok_1, bar_center, rx=0.82, ry=0.74)
            self.play_until(
                cue["flip"].end,
                FadeTransform(whisper_1, whisper_2),
                orb_3,
                orb_1,
            )

            self.sema.fly_to(
                np.array([-4.4, -1.65, 0.0]),
                look_at=sign_anchor,
                state="guiding",
                expression="happy",
                prompt=SemaPrompt(
                    callout="− becomes +",
                    say="Negate the slope: negative spins straight into positive!",
                    subtitle="Switch the negative sign to positive.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["sign"].end,
                FadeTransform(whisper_2, whisper_3),
                spin_sign_anim(tok_sign, plus_template=tok_plus_tpl, anchor=sign_anchor),
                FadeTransform(tok_m, tok_mperp),
            )

            self.sema.fly_to(
                np.array([4.2, -2.2, 0.0]),
                look_at=res_pill,
                state="celebrate",
                expression="proud",
                prompt=SemaPrompt(
                    callout="m⊥ = +1/3!",
                    say="Negative reciprocal complete: m⊥ = +1/3!",
                    subtitle="Perpendicular slope: m⊥ = +1/3.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["done"].end,
                FadeIn(res_pill, shift=UP * 0.22, scale=0.9),
            )


class L1P3_Alg3(SyntaxScene):
    """Beat 3 (Algebra): Color-coded token substitution cascade solving for b."""

    def construct(self) -> None:
        th = self.theme

        w1 = make_whisper("Drop P(6, 1) and m⊥ = 1/3 into y = mx + b", th)
        w2 = make_whisper("Multiply (1/3)(6) = 2", th)
        w3 = make_whisper("Subtract 2 from both sides → b = −1", th)

        # Row 1:  [1]  =  [(1/3)(6)]  + b
        r1_y = make_math_chip("1", th, accent="amber", font_size=44)
        r1_eq = make_token("=", th, color="muted", font_size=52)
        r1_mx = make_math_chip("(1/3)(6)", th, accent="teal", font_size=42)
        r1_b = make_token("+ b", th, color="ink", font_size=52)
        row1 = VGroup(r1_y, r1_eq, r1_mx, r1_b).arrange(RIGHT, buff=0.34).shift(UP * 1.45)

        # Row 2:  [1]  =  [2]  + b
        r2_y = make_math_chip("1", th, accent="amber", font_size=44)
        r2_eq = make_token("=", th, color="muted", font_size=52)
        r2_mx = make_math_chip("2", th, accent="blue", font_size=44)
        r2_b = make_token("+ b", th, color="ink", font_size=52)
        row2 = VGroup(r2_y, r2_eq, r2_mx, r2_b).arrange(RIGHT, buff=0.34).shift(DOWN * 0.12)

        # Row 3:  Final green result pill
        res_pill = make_result_pill("b = −1   →   y = 1/3 x − 1", th, accent="green", font_size=36).shift(
            DOWN * 2.05
        )

        self.sema.enter(
            np.array([-5.1, 1.55, 0.0]),
            look_at=row1,
            state="speaking",
            expression="attentive",
            prompt=SemaPrompt(
                callout="Plug in P(6, 1)",
                say="Drop x = 6, y = 1, and m⊥ = 1/3 into y = mx + b.",
                subtitle="Substitute P(6, 1) and m⊥ = 1/3 into y = mx + b.",
                accent="amber",
            ),
            avoid_overlap=False,
        )

        with self.narrate(
            "Now <cue:sub>plug our slope one third and point six, one into y equals m x plus b</cue>. "
            "<cue:mult>One third of six simplifies cleanly to two</cue>. "
            "Subtract two from one to get <cue:solve>b equals negative one</cue>, "
            "giving our final line: <cue:final>y equals one third x minus one</cue>."
        ) as cue:
            self.play_until(
                cue["sub"].end,
                FadeIn(w1, shift=DOWN * 0.1),
                FadeIn(row1, shift=UP * 0.16),
            )

            self.sema.fly_to(
                np.array([4.95, 0.35, 0.0]),
                look_at=r2_mx,
                state="guiding",
                expression="curious",
                prompt=SemaPrompt(
                    callout="(1/3)(6) = 2",
                    say="A third of 6 is just 2 — super clean!",
                    subtitle="Multiply (1/3)(6) to get 2.",
                    accent="teal",
                ),
            )
            self.play_until(
                cue["mult"].end,
                FadeTransform(w1, w2),
                Indicate(r1_mx, color=th.teal, scale_factor=1.10),
                row1.animate.set_opacity(0.45),
                FadeIn(row2, shift=DOWN * 0.18),
            )

            self.sema.fly_to(
                np.array([-5.0, -1.95, 0.0]),
                look_at=res_pill,
                state="nodding",
                expression="happy",
                prompt=SemaPrompt(
                    callout="b = −1",
                    say="1 minus 2 gives b = −1!",
                    subtitle="Subtract 2 from 1 to get b = −1.",
                    accent="blue",
                ),
            )
            self.play_until(
                cue["solve"].end,
                FadeTransform(w2, w3),
                row2.animate.set_opacity(0.55),
                FadeIn(res_pill, shift=UP * 0.22, scale=0.92),
            )

            self.sema.react(
                state="celebrate",
                expression="proud",
                look_at=res_pill,
                prompt=SemaPrompt(
                    callout="y = 1/3 x − 1!",
                    say="Done! Our perpendicular line is y = 1/3 x − 1!",
                    subtitle="Final line: y = 1/3 x − 1.",
                    accent="green",
                ),
            )
            self.play_until(
                cue["final"].end,
                Indicate(res_pill, color=th.green, scale_factor=1.06),
            )
