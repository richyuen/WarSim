// Must fail warsim/no-literal-ui-string: literal user-facing text in a UI component.
export function Bad() {
  return (
    <div title="Hover text">
      Declare war
      <button aria-label="Close">{'Peace'}</button>
    </div>
  );
}
