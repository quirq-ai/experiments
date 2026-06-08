"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function SidebarModeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	const handleThemeToggle = () => {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	};

	const getThemeIcon = () => {
		if (!mounted) return <Sun className="h-4 w-4" />;

		switch (theme) {
			case "dark":
				return <Moon className="h-4 w-4" />;
			case "system":
				return <Monitor className="h-4 w-4" />;
			default:
				return <Sun className="h-4 w-4" />;
		}
	};

	const getThemeLabel = () => {
		if (!mounted) return "Theme";

		switch (theme) {
			case "dark":
				return "Dark";
			case "system":
				return "System";
			default:
				return "Light";
		}
	};

	const getTooltipText = () => {
		if (!mounted) return "Toggle theme";

		switch (theme) {
			case "light":
				return "Switch to dark mode";
			case "dark":
				return "Switch to system mode";
			case "system":
				return "Switch to light mode";
			default:
				return "Toggle theme";
		}
	};

	return (
		<SidebarMenuButton onClick={handleThemeToggle} tooltip={getTooltipText()}>
			{getThemeIcon()}
			<span>{getThemeLabel()}</span>
		</SidebarMenuButton>
	);
}
