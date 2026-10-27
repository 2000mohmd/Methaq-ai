import { Fragment, type ReactNode } from "react";
import { Text, View, type TextStyle } from "react-native";

import { C, F } from "../lib/theme";

/**
 * Small markdown renderer for model output: #-headings, **bold**, "-"/"•" bullets,
 * numbered lines, [S1] citation pills and "---" separators. Text stays selectable.
 * ponytail: line-based, no nesting/tables/links — swap for a real parser if answers need them.
 */
export function MdText({ text, color = C.fg, size = 15 }: { text: string; color?: string; size?: number }) {
  const base: TextStyle = { fontFamily: F.regular, fontSize: size, lineHeight: Math.round(size * 1.65), color, textAlign: "left" };
  const blocks: ReactNode[] = [];

  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) return;
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<View key={i} style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />);
    } else if ((m = line.match(/^\s*(#{1,6})\s+(.*)$/))) {
      const big = m[1].length <= 2;
      blocks.push(
        <Text key={i} selectable style={[base, { fontFamily: big ? F.bold : F.semibold, fontSize: size + (big ? 3 : 1), color: C.navy, marginTop: 6 }]}>
          {inline(m[2].replace(/\*\*/g, ""), base)}
        </Text>,
      );
    } else if ((m = line.match(/^(\s*)(?:[-•*]|(\d+)[.)])\s+(.*)$/))) {
      blocks.push(
        <View key={i} style={{ flexDirection: "row", gap: 8, paddingStart: m[1].length > 1 ? 16 : 0 }}>
          {m[2] ? (
            <Text style={[base, { fontFamily: F.semibold, color: C.teal, minWidth: 18 }]}>{m[2]}.</Text>
          ) : (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal, marginTop: base.lineHeight! / 2 - 3 }} />
          )}
          <Text selectable style={[base, { flex: 1 }]}>{inline(m[3], base)}</Text>
        </View>,
      );
    } else {
      blocks.push(<Text key={i} selectable style={base}>{inline(line, base)}</Text>);
    }
  });

  return <View style={{ gap: 6 }}>{blocks}</View>;
}

/** **bold** and [S1] / [S1, S2] citation pills inside one line. */
function inline(line: string, base: TextStyle) {
  return line.split(/(\*\*[^*]+\*\*|\[S\d+(?:\s*[,،]\s*S\d+)*\])/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <Text key={i} style={{ fontFamily: F.bold, color: base.color === C.fg ? C.navy : base.color }}>{part.slice(2, -2)}</Text>;
    if (/^\[S\d/.test(part))
      return (
        <Text key={i} style={{ fontFamily: F.semibold, fontSize: (base.fontSize ?? 15) - 3, color: C.teal, backgroundColor: C.tealTint }}>
          {" "}{part.slice(1, -1)}{" "}
        </Text>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}
