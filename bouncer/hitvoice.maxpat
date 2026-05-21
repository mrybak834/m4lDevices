{
	"patcher" : 	{
		"fileversion" : 1,
		"appversion" : 		{
			"major" : 9,
			"minor" : 1,
			"revision" : 4,
			"architecture" : "x64",
			"modernui" : 1
		}
,
		"classnamespace" : "box",
		"rect" : [ 100.0, 100.0, 900.0, 620.0 ],
		"default_fontsize" : 10.0,
		"default_fontname" : "Arial Bold",
		"gridsize" : [ 8.0, 8.0 ],
		"title" : "hitvoice",
		"boxes" : [
			{
				"box" : 				{
					"id" : "obj-in1",
					"maxclass" : "newobj",
					"numinlets" : 0,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 40.0, 40.0, 32.0, 22.0 ],
					"text" : "in 1"
				}
			},
			{
				"box" : 				{
					"id" : "obj-in2",
					"maxclass" : "newobj",
					"numinlets" : 0,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 300.0, 40.0, 36.0, 22.0 ],
					"text" : "in~ 2"
				}
			},
			{
				"box" : 				{
					"id" : "obj-in3",
					"maxclass" : "newobj",
					"numinlets" : 0,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 380.0, 40.0, 36.0, 22.0 ],
					"text" : "in~ 3"
				}
			},
			{
				"box" : 				{
					"id" : "obj-trig",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "bang", "" ],
					"patching_rect" : [ 40.0, 75.0, 50.0, 22.0 ],
					"text" : "t b l"
				}
			},
			{
				"box" : 				{
					"id" : "obj-unpack",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 3,
					"outlettype" : [ "int", "float", "float" ],
					"patching_rect" : [ 95.0, 110.0, 120.0, 22.0 ],
					"text" : "unpack 0 0. 0."
				}
			},
			{
				"box" : 				{
					"id" : "obj-envmsg",
					"maxclass" : "message",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 40.0, 110.0, 65.0, 22.0 ],
					"text" : "1 5 0 80"
				}
			},
			{
				"box" : 				{
					"id" : "obj-line",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 2,
					"outlettype" : [ "signal", "bang" ],
					"patching_rect" : [ 40.0, 145.0, 50.0, 22.0 ],
					"text" : "line~"
				}
			},
			{
				"box" : 				{
					"id" : "obj-tapout-l",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 300.0, 110.0, 70.0, 22.0 ],
					"text" : "tapout~ 0"
				}
			},
			{
				"box" : 				{
					"id" : "obj-tapout-r",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 380.0, 110.0, 70.0, 22.0 ],
					"text" : "tapout~ 0"
				}
			},
			{
				"box" : 				{
					"id" : "obj-sum",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 300.0, 150.0, 40.0, 22.0 ],
					"text" : "+~"
				}
			},
			{
				"box" : 				{
					"id" : "obj-mult-env",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 300.0, 190.0, 40.0, 22.0 ],
					"text" : "*~"
				}
			},
			{
				"box" : 				{
					"id" : "obj-mult-gain",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 300.0, 225.0, 50.0, 22.0 ],
					"text" : "*~ 1."
				}
			},
			{
				"box" : 				{
					"id" : "obj-pan-l-expr",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "float" ],
					"patching_rect" : [ 200.0, 270.0, 140.0, 22.0 ],
					"text" : "expr (1.-$f1)*0.5"
				}
			},
			{
				"box" : 				{
					"id" : "obj-pan-r-expr",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "float" ],
					"patching_rect" : [ 360.0, 270.0, 140.0, 22.0 ],
					"text" : "expr (1.+$f1)*0.5"
				}
			},
			{
				"box" : 				{
					"id" : "obj-mult-pan-l",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 250.0, 305.0, 50.0, 22.0 ],
					"text" : "*~ 0.5"
				}
			},
			{
				"box" : 				{
					"id" : "obj-mult-pan-r",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "signal" ],
					"patching_rect" : [ 360.0, 305.0, 50.0, 22.0 ],
					"text" : "*~ 0.5"
				}
			},
			{
				"box" : 				{
					"id" : "obj-out1",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 250.0, 350.0, 40.0, 22.0 ],
					"text" : "out~ 1"
				}
			},
			{
				"box" : 				{
					"id" : "obj-out2",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 360.0, 350.0, 40.0, 22.0 ],
					"text" : "out~ 2"
				}
			},
			{
				"box" : 				{
					"id" : "obj-cmt1",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 80.0, 40.0, 200.0, 18.0 ],
					"text" : "control: list [delay gain pan]"
				}
			},
			{
				"box" : 				{
					"id" : "obj-cmt2",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 440.0, 40.0, 200.0, 18.0 ],
					"text" : "tapin~ feed (L, R)"
				}
			}
		],
		"lines" : [
			{ "patchline" : { "destination" : [ "obj-trig", 0 ], "source" : [ "obj-in1", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-envmsg", 0 ], "source" : [ "obj-trig", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-unpack", 0 ], "source" : [ "obj-trig", 1 ] } },
			{ "patchline" : { "destination" : [ "obj-line", 0 ], "source" : [ "obj-envmsg", 0 ] } },

			{ "patchline" : { "destination" : [ "obj-tapout-l", 1 ], "source" : [ "obj-unpack", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-tapout-r", 1 ], "source" : [ "obj-unpack", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-gain", 1 ], "source" : [ "obj-unpack", 1 ] } },
			{ "patchline" : { "destination" : [ "obj-pan-l-expr", 0 ], "source" : [ "obj-unpack", 2 ] } },
			{ "patchline" : { "destination" : [ "obj-pan-r-expr", 0 ], "source" : [ "obj-unpack", 2 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-pan-l", 1 ], "source" : [ "obj-pan-l-expr", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-pan-r", 1 ], "source" : [ "obj-pan-r-expr", 0 ] } },

			{ "patchline" : { "destination" : [ "obj-tapout-l", 0 ], "source" : [ "obj-in2", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-tapout-r", 0 ], "source" : [ "obj-in3", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-sum", 0 ], "source" : [ "obj-tapout-l", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-sum", 1 ], "source" : [ "obj-tapout-r", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-env", 0 ], "source" : [ "obj-sum", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-env", 1 ], "source" : [ "obj-line", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-gain", 0 ], "source" : [ "obj-mult-env", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-pan-l", 0 ], "source" : [ "obj-mult-gain", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-mult-pan-r", 0 ], "source" : [ "obj-mult-gain", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-out1", 0 ], "source" : [ "obj-mult-pan-l", 0 ] } },
			{ "patchline" : { "destination" : [ "obj-out2", 0 ], "source" : [ "obj-mult-pan-r", 0 ] } }
		]
	}
}
