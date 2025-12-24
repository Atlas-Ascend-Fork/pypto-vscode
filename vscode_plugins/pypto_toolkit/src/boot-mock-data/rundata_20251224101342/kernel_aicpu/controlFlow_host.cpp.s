	.arch armv8-a
	.file	"controlFlow_host.cpp"
	.text
	.section	ast2,"ax",@progbits
	.align	2
	.p2align 4,,11
	.global	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE
	.type	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE, %function
_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE:
.LFB895:
	.cfi_startproc
	stp	x29, x30, [sp, -112]!
	.cfi_def_cfa_offset 112
	.cfi_offset 29, -112
	.cfi_offset 30, -104
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	.cfi_offset 19, -96
	.cfi_offset 20, -88
	mov	x20, x2
	mov	x19, 128
	stp	x21, x22, [sp, 32]
	.cfi_offset 21, -80
	.cfi_offset 22, -72
	mov	x21, x0
	mov	x22, x3
	stp	x27, x28, [sp, 80]
	.cfi_offset 27, -32
	.cfi_offset 28, -24
	mov	x28, x1
	mov	x27, 6
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	.cfi_offset 23, -64
	.cfi_offset 24, -56
	.cfi_offset 25, -48
	.cfi_offset 26, -40
	str	xzr, [sp, 104]
.L4:
	ldr	x0, [x22]
	str	xzr, [x28, 72]
	ldr	x2, [sp, 104]
	str	x2, [x28, 56]
	add	x1, x0, 192
	mov	x26, 0
	ldr	x0, [x0, 192]
	mov	x3, x2
	mov	x25, 32
	mov	x24, 64
	ldr	w5, [x0, x2, lsl 2]
	add	w0, w5, 254
	adds	w5, w5, 127
	csel	w0, w0, w5, mi
	asr	w0, w0, 7
	sxtw	x23, w0
	cbnz	w0, .L2
	b	.L25
	.p2align 2,,3
.L5:
	ldr	w1, [x0, x3, lsl 2]
	add	w0, w1, 254
	adds	w1, w1, 127
	csel	w0, w0, w1, mi
	asr	w0, w0, 7
	sub	w0, w0, #1
	cmp	x26, x0, sxtw
	bcc	.L16
	mov	x1, 1
	mov	x0, x21
	blr	x5
	ldr	x3, [x22]
	mov	x1, 5
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	stp	x27, x1, [x0]
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	ldr	x1, [x28, 56]
	str	x1, [x0, 56]
	ldr	x1, [x28, 64]
	str	x1, [x0, 64]
	ldr	x1, [x28, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x28, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x28, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x1, [x28, 56]
	ldr	x5, [x28, 72]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x1, [x28, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L17
	cmp	x1, 0
	csel	x6, x1, xzr, ge
	cmp	x6, 64
	csel	x6, x6, x24, le
.L17:
	str	x6, [x0, 104]
	mov	x5, 64
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L18
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L18:
	str	x5, [x0, 112]
	mov	x5, 64
	ldr	x1, [x28, 56]
	ldr	x6, [x28, 72]
	add	x1, x1, x6
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x7, x6, [x28, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L19
	cmp	x1, 0
	csel	x5, x1, xzr, ge
	cmp	x5, 64
	csel	x5, x5, x24, le
.L19:
	str	x5, [x0, 136]
	mov	x5, 64
	ldp	x6, x1, [x28, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x6, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	bgt	.L20
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L20:
	ldr	x3, [x20, 8]
	str	x5, [x0, 144]
	mov	x1, 1
	mov	x0, x21
	blr	x3
.L11:
	add	x26, x26, 1
	cmp	x23, x26
	beq	.L25
.L46:
	ldr	x0, [x22]
	ldr	x3, [x28, 56]
	add	x1, x0, 192
.L2:
	ldr	x5, [x20]
	str	x26, [x28, 64]
	ldr	x0, [x1]
	cbnz	x26, .L5
	ldr	w0, [x0, x3, lsl 2]
	sub	w0, w0, #1
	cmp	w0, 127
	bhi	.L6
	mov	x1, 3
	mov	x0, x21
	blr	x5
	ldr	x3, [x22]
	mov	x1, 5
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	stp	x27, x1, [x0]
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	ldr	x1, [x28, 56]
	str	x1, [x0, 56]
	ldr	x1, [x28, 64]
	str	x1, [x0, 64]
	ldr	x1, [x28, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x28, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x28, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x1, [x28, 56]
	ldr	x5, [x28, 72]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x1, [x28, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L7
	cmp	x1, 0
	csel	x6, x1, xzr, ge
	cmp	x6, 64
	csel	x6, x6, x24, le
.L7:
	str	x6, [x0, 104]
	mov	x5, 64
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L8
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L8:
	str	x5, [x0, 112]
	mov	x5, 64
	ldr	x1, [x28, 56]
	ldr	x6, [x28, 72]
	add	x1, x1, x6
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x7, x6, [x28, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L9
	cmp	x1, 0
	csel	x5, x1, xzr, ge
	cmp	x5, 64
	csel	x5, x5, x24, le
.L9:
	str	x5, [x0, 136]
	mov	x5, 64
	ldp	x6, x1, [x28, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x6, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	bgt	.L10
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L10:
	ldr	x3, [x20, 8]
	str	x5, [x0, 144]
	mov	x1, 3
	mov	x0, x21
	add	x26, x26, 1
	blr	x3
	cmp	x23, x26
	bne	.L46
	.p2align 3,,7
.L25:
	ldr	x0, [sp, 104]
	add	x0, x0, 1
	str	x0, [sp, 104]
	cmp	x0, 4
	bne	.L4
	ldr	x2, [x20, 8]
	mov	x0, x21
	mov	x1, -1
	blr	x2
	mov	x0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 112
	.cfi_remember_state
	.cfi_restore 30
	.cfi_restore 29
	.cfi_restore 27
	.cfi_restore 28
	.cfi_restore 25
	.cfi_restore 26
	.cfi_restore 23
	.cfi_restore 24
	.cfi_restore 21
	.cfi_restore 22
	.cfi_restore 19
	.cfi_restore 20
	.cfi_def_cfa_offset 0
	ret
	.p2align 2,,3
.L16:
	.cfi_restore_state
	mov	x1, 0
	mov	x0, x21
	blr	x5
	ldr	x3, [x22]
	mov	x1, 5
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	stp	x27, x1, [x0]
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	ldr	x1, [x28, 56]
	str	x1, [x0, 56]
	ldr	x1, [x28, 64]
	str	x1, [x0, 64]
	ldr	x1, [x28, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x28, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x28, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x1, [x28, 56]
	ldr	x5, [x28, 72]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x1, [x28, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L21
	cmp	x1, 0
	csel	x6, x1, xzr, ge
	cmp	x6, 64
	csel	x6, x6, x24, le
.L21:
	str	x6, [x0, 104]
	mov	x5, 64
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L22
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L22:
	str	x5, [x0, 112]
	mov	x5, 64
	ldr	x1, [x28, 56]
	ldr	x6, [x28, 72]
	add	x1, x1, x6
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x7, x6, [x28, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L23
	cmp	x1, 0
	csel	x5, x1, xzr, ge
	cmp	x5, 64
	csel	x5, x5, x24, le
.L23:
	str	x5, [x0, 136]
	mov	x5, 64
	ldp	x6, x1, [x28, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x6, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	bgt	.L24
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L24:
	ldr	x3, [x20, 8]
	str	x5, [x0, 144]
	mov	x1, 0
	mov	x0, x21
	blr	x3
	b	.L11
	.p2align 2,,3
.L6:
	mov	x1, 2
	mov	x0, x21
	blr	x5
	ldr	x3, [x22]
	mov	x1, 5
	mov	x6, 64
	ldrsw	x5, [x3, 176]
	stp	x27, x1, [x0]
	stp	xzr, xzr, [x0, 16]
	stp	xzr, xzr, [x0, 32]
	str	xzr, [x0, 48]
	ldr	x1, [x28, 56]
	str	x1, [x0, 56]
	ldr	x1, [x28, 64]
	str	x1, [x0, 64]
	ldr	x1, [x28, 72]
	str	x1, [x0, 72]
	ldp	x1, x8, [x28, 56]
	ldr	x7, [x3, 160]
	madd	x1, x5, x1, x8
	ldr	w1, [x7, x1, lsl 2]
	lsl	w1, w1, 7
	add	w1, w1, 64
	sxtw	x1, w1
	str	x1, [x0, 80]
	ldp	x8, x7, [x28, 56]
	ldr	x1, [x3, 160]
	madd	x5, x5, x8, x7
	ldr	w1, [x1, x5, lsl 2]
	lsl	w1, w1, 7
	sxtw	x1, w1
	str	x1, [x0, 88]
	ldr	x1, [x28, 56]
	ldr	x5, [x28, 72]
	add	x1, x1, x5
	lsl	x1, x1, 5
	str	x1, [x0, 96]
	ldp	x7, x1, [x28, 56]
	ldr	x5, [x3, 192]
	ldrsw	x5, [x5, x7, lsl 2]
	sub	x1, x5, x1, lsl 7
	cmp	x1, 127
	bgt	.L12
	cmp	x1, 0
	csel	x6, x1, xzr, ge
	cmp	x6, 64
	csel	x6, x6, x24, le
.L12:
	str	x6, [x0, 104]
	mov	x5, 64
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L13
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L13:
	str	x5, [x0, 112]
	mov	x5, 64
	ldr	x1, [x28, 56]
	ldr	x6, [x28, 72]
	add	x1, x1, x6
	subs	x1, x19, x1, lsl 5
	csel	x1, x1, xzr, pl
	cmp	x1, 32
	csel	x1, x1, x25, le
	str	x1, [x0, 120]
	ldp	x7, x6, [x28, 56]
	ldr	x1, [x3, 192]
	ldrsw	x1, [x1, x7, lsl 2]
	subs	x1, x1, x6, lsl 7
	csel	x1, x1, xzr, pl
	cmp	x1, 128
	csel	x1, x1, x19, le
	str	x1, [x0, 128]
	ldp	x7, x1, [x28, 56]
	ldr	x6, [x3, 192]
	ldrsw	x6, [x6, x7, lsl 2]
	sub	x1, x6, x1, lsl 7
	cmp	x1, 127
	bgt	.L14
	cmp	x1, 0
	csel	x5, x1, xzr, ge
	cmp	x5, 64
	csel	x5, x5, x24, le
.L14:
	str	x5, [x0, 136]
	mov	x5, 64
	ldp	x6, x1, [x28, 56]
	ldr	x3, [x3, 192]
	ldrsw	x3, [x3, x6, lsl 2]
	sub	x1, x3, x1, lsl 7
	cmp	x1, 127
	bgt	.L15
	subs	x5, x1, #64
	csel	x5, x5, xzr, pl
.L15:
	ldr	x3, [x20, 8]
	str	x5, [x0, 144]
	mov	x1, 2
	mov	x0, x21
	blr	x3
	b	.L11
	.cfi_endproc
.LFE895:
	.size	_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE, .-_ZN3npu8tile_fwk16ControlFlowEntryEPvPmPPFS1_S1_mEPNS0_16DevStartArgsBaseE
	.ident	"GCC: (GNU) 10.3.1"
	.section	.note.GNU-stack,"",@progbits
