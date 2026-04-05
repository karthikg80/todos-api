import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EditableTitle } from "./EditableTitle";

describe("EditableTitle", () => {
  it("renders title text by default", () => {
    render(<EditableTitle value="My Project" onSave={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Project");
  });

  it("enters edit mode on click", () => {
    render(<EditableTitle value="My Project" onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("textbox")).toHaveValue("My Project");
  });

  it("saves on Enter", () => {
    const onSave = vi.fn();
    render(<EditableTitle value="My Project" onSave={onSave} />);
    fireEvent.click(screen.getByRole("heading", { level: 1 }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("Renamed");
  });

  it("cancels on Escape", () => {
    const onSave = vi.fn();
    render(<EditableTitle value="My Project" onSave={onSave} />);
    fireEvent.click(screen.getByRole("heading", { level: 1 }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Project");
  });

  it("saves on blur", () => {
    const onSave = vi.fn();
    render(<EditableTitle value="My Project" onSave={onSave} />);
    fireEvent.click(screen.getByRole("heading", { level: 1 }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Renamed" } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onSave).toHaveBeenCalledWith("Renamed");
  });

  it("does not save empty name", () => {
    const onSave = vi.fn();
    render(<EditableTitle value="My Project" onSave={onSave} />);
    fireEvent.click(screen.getByRole("heading", { level: 1 }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("supports controlled editing prop", () => {
    render(<EditableTitle value="My Project" onSave={vi.fn()} editing={true} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
