//go:build !windows

package main

import (
	"fmt"
	"log"
)

func openWindow(url string) error { return fmt.Errorf("Use --no-open for the development service at %s",url) }
func showError(message string) { log.Print(message) }
