const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Shows `text` with rolling digits (an odometer): every digit is a column of
 * 0–9 that slides to the new digit when the value changes. Screen readers
 * and copying get the plain text once; the columns are hidden from them.
 * Rows are 1.15em high, so it fits the line it sits in.
 */
export function RollingNumber({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="select-none">
        {words.map((word, w) => (
          <span key={words.length - w}>
            {w > 0 && " "}
            <span className="inline-flex whitespace-nowrap">
              {[...word].map((char, i) => {
                // Keyed from the right, so the ones digit stays the ones
                // digit when the number grows and its column can roll.
                const digit = /\d/.test(char);
                const key = `${word.length - i}-${digit ? "d" : char}`;
                return digit ? (
                  <span
                    key={key}
                    className="inline-block h-[1.15em] overflow-hidden leading-[1.15em]"
                  >
                    <span
                      className="flex flex-col transition-transform duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                      style={{
                        transform: `translateY(calc(${char} * -1.15em))`,
                      }}
                    >
                      {DIGITS.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </span>
                  </span>
                ) : (
                  <span
                    key={key}
                    className="inline-block h-[1.15em] leading-[1.15em]"
                  >
                    {char}
                  </span>
                );
              })}
            </span>
          </span>
        ))}
      </span>
    </>
  );
}
